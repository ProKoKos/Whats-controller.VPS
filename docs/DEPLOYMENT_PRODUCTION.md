# Развёртывание в продакшен

Полная инструкция по развёртыванию WMOC SaaS Platform в продакшене.

## Архитектура

```
Интернет (80/443)
    ↓
Роутер (проброс портов)
    ↓
┌─────────────────────────────────────────┐
│  Proxmox                                │
│  ┌───────────────────────────────────┐   │
│  │  Alpine Container (192.168.100.101)│   │
│  │  Caddy (reverse proxy)            │   │
│  │  Порты: 80, 443                   │   │
│  └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
    ↓ (проксирование на внутренний IP)
┌─────────────────────────────────────────┐
│  Ubuntu 24.04 (192.168.100.102)         │
│  ┌───────────────────────────────────┐ │
│  │  Docker контейнеры:              │ │
│  │  • API (порт 3000)                │ │
│  │  • PostgreSQL (5432)              │ │
│  │  • Redis (6379)                   │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## Шаг 1: Настройка Caddy на Alpine (192.168.100.101)

### 1.1. Подключение к контейнеру

```bash
ssh root@192.168.100.101
# или через Proxmox консоль
```

### 1.2. Обновление Caddyfile

Отредактируйте `/etc/caddy/Caddyfile`:

```caddy
wmoc.online {
    # Логирование
    log {
        output file /var/log/caddy/access.log
        format json
    }

    # API routes (most specific first)
    handle /api/* {
        reverse_proxy 192.168.100.102:3000 {
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up Host {host}
        }
    }

    # Controller proxy routes
    handle /c/* {
        reverse_proxy 192.168.100.102:3000 {
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up Host {host}
        }
    }

    # WebSocket tunnel
    handle /tunnel {
        reverse_proxy 192.168.100.102:3000 {
            transport http {
                read_timeout 3600s
                write_timeout 3600s
            }
            header_up Connection {>Connection}
            header_up Upgrade {>Upgrade}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up Host {host}
        }
    }

    # Health check
    handle /health {
        reverse_proxy 192.168.100.102:3000
    }

    # Static files and landing page (catch-all, must be last)
    handle {
        reverse_proxy 192.168.100.102:3000 {
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up Host {host}
        }
    }
}
```

**Важно:** В Caddy используется `handle` для правильной маршрутизации. Более специфичные маршруты (`/api/*`, `/c/*`) должны быть первыми, а catch-all `handle` без пути — последним.

### 1.3. Проверка и перезагрузка Caddy

```bash
# Проверить конфигурацию
caddy validate --config /etc/caddy/Caddyfile

# Перезагрузить Caddy
rc-service caddy reload
# или
caddy reload --config /etc/caddy/Caddyfile

# Проверить статус
rc-service caddy status
```

### 1.4. Проверка логов (опционально)

```bash
tail -f /var/log/caddy/access.log
```

---

## Шаг 2: Настройка Ubuntu сервера (192.168.100.102)

### 2.1. Подключение к серверу

```bash
ssh root@192.168.100.102
# или
ssh ubuntu@192.168.100.102
```

### 2.2. Обновление системы

```bash
apt update && apt upgrade -y
```

### 2.3. Создание пользователя (если работаете от root)

```bash
adduser wmoc
usermod -aG sudo wmoc
su - wmoc
```

### 2.4. Настройка firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow from 192.168.100.101 to any port 3000 proto tcp  # Только от Caddy
sudo ufw allow from 192.168.100.101 to any port 3001 proto tcp  # WebSocket от Caddy
sudo ufw enable
```

> **Важно:** Порты 3000 и 3001 должны быть доступны только из внутренней сети (от Caddy), не из интернета.

### 2.5. Установка Docker и Docker Compose

```bash
# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Выйти и зайти снова для применения группы docker
exit
# Подключиться снова
ssh wmoc@192.168.100.102

# Проверить установку
docker --version
docker compose version
```

### 2.6. Установка Git

```bash
sudo apt install -y git
```

### 2.7. Клонирование репозитория

```bash
cd ~
git clone https://github.com/ProKoKos/Whats-controller.VPS.git wmoc-server
cd wmoc-server/server
```

### 2.8. Настройка переменных окружения

```bash
# Создать .env файл
nano .env  # или используйте ваш любимый редактор
```

**Важные параметры для `.env`:**

```env
# Server Configuration
NODE_ENV=production
PORT=3000
TUNNEL_PORT=3001

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=wmoc_saas
DB_USER=wmoc
DB_PASSWORD=your-secure-password-here
DATABASE_URL=postgresql://wmoc:your-secure-password-here@postgres:5432/wmoc_saas

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=your-very-secure-random-jwt-secret-key-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=https://wmoc.online

# WebSocket Tunnel
TUNNEL_PATH=/tunnel

# Domain
DOMAIN=wmoc.online

# Logging
LOG_LEVEL=info
```

> **Важно:** 
> - `JWT_SECRET` должен быть длинным случайным ключом (минимум 32 символа)
> - `DB_PASSWORD` должен быть надёжным паролем
> - Используйте `openssl rand -base64 32` для генерации секретов
> - В `DATABASE_URL` специальные символы в пароле должны быть URL-encoded

### 2.9. Создание необходимых директорий

```bash
mkdir -p logs backups
```

### 2.10. Запуск через Docker Compose

```bash
# Запустить все сервисы (PostgreSQL, Redis, API)
docker compose up -d --build

# Проверить статус
docker compose ps

# Посмотреть логи
docker compose logs -f api
```

### 2.11. Применение миграций базы данных

```bash
# Скопировать SQL миграцию в контейнер
docker cp src/database/migrations/001_initial_schema.sql wmoc-postgres:/tmp/

# Применить миграцию
docker compose exec postgres psql -U wmoc -d wmoc_saas -f /tmp/001_initial_schema.sql

# Проверить что таблицы созданы
docker compose exec postgres psql -U wmoc -d wmoc_saas -c "\dt"
```

### 2.12. Проверка работы

```bash
# Проверить health endpoint
curl http://localhost:3000/health

# Через Caddy (если DNS настроен)
curl https://wmoc.online/health
```

---

## Обновление проекта

После изменений в коде:

```bash
cd ~/wmoc-server
git pull
cd server

# Пересобрать и перезапустить контейнеры
docker compose build api
docker compose up -d api

# Или перезапустить все сервисы
docker compose up -d --build
```

---

## Управление сервисами

### Запуск/остановка

```bash
# Запустить все сервисы
docker compose up -d

# Остановить все сервисы
docker compose down

# Остановить только API
docker compose stop api

# Перезапустить API
docker compose restart api
```

### Логи

```bash
# Все логи
docker compose logs -f

# Только API
docker compose logs -f api

# Последние 100 строк
docker compose logs --tail=100 api
```

### Статус

```bash
# Статус контейнеров
docker compose ps

# Использование ресурсов
docker stats
```

---

## Резервное копирование

### Бэкап базы данных

```bash
# Создать бэкап
docker compose exec postgres pg_dump -U wmoc wmoc_saas > backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Автоматический бэкап (добавить в crontab)
# 0 2 * * * cd /home/wmoc/wmoc-server/server && docker compose exec -T postgres pg_dump -U wmoc wmoc_saas > backups/backup_$(date +\%Y\%m\%d_\%H\%M\%S).sql
```

### Восстановление из бэкапа

```bash
docker compose exec -T postgres psql -U wmoc -d wmoc_saas < backups/backup_YYYYMMDD_HHMMSS.sql
```

---

## Мониторинг

### Проверка использования ресурсов

```bash
# Docker контейнеры
docker stats

# Системные ресурсы
htop
df -h
```

### Health checks

```bash
# API health
curl http://localhost:3000/health

# Через Caddy
curl https://wmoc.online/health
```

---

## Безопасность

### Рекомендации

1. ✅ Firewall настроен (только необходимые порты)
2. ✅ API доступен только из внутренней сети
3. ✅ PostgreSQL и Redis только локально
4. ✅ Используйте сильные пароли в `.env`
5. ✅ Регулярно обновляйте систему: `apt update && apt upgrade`
6. ✅ Регулярно обновляйте Docker образы
7. ✅ Настройте автоматические бэкапы БД

### Проверка безопасности

```bash
# Проверить открытые порты
sudo netstat -tulpn | grep LISTEN

# Проверить firewall
sudo ufw status verbose
```

---

## Troubleshooting

### API не отвечает

```bash
# Проверить статус контейнеров
docker compose ps

# Проверить логи
docker compose logs api

# Проверить подключение к БД
docker compose exec api ping postgres
```

### Caddy не может подключиться к API

```bash
# На Ubuntu сервере проверить доступность порта
sudo netstat -tulpn | grep 3000

# Проверить firewall
sudo ufw status

# Проверить логи Caddy на Alpine контейнере
ssh root@192.168.100.101
tail -f /var/log/caddy/access.log
```

### База данных не подключается

```bash
# Проверить что контейнер запущен
docker compose ps postgres

# Проверить логи
docker compose logs postgres

# Проверить подключение
docker compose exec postgres psql -U wmoc -d wmoc_saas -c "SELECT 1;"
```

### Ошибки при сборке Docker образа

```bash
# Очистить кэш Docker
docker system prune -a

# Пересобрать без кэша
docker compose build --no-cache api
```

---

## Важные замечания

1. **Node.js НЕ нужен на хосте** - всё работает через Docker контейнеры
2. **Frontend не развёрнут на продакшене** - пока используется только Backend API
3. **Все сервисы в Docker** - PostgreSQL, Redis, API
4. **Caddy на отдельном контейнере** - обрабатывает SSL и проксирование
5. **Миграции применяются вручную** - через `docker compose exec`

---

## Быстрый старт (после первоначальной настройки)

```bash
cd ~/wmoc-server/server

# Обновить код
git pull

# Пересобрать и перезапустить
docker compose up -d --build

# Применить новые миграции (если есть)
docker cp src/database/migrations/001_initial_schema.sql wmoc-postgres:/tmp/
docker compose exec postgres psql -U wmoc -d wmoc_saas -f /tmp/001_initial_schema.sql
```
