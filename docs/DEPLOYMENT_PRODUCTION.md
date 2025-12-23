# Развёртывание в продакшен (Proxmox + Ubuntu)

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

## Шаг 1: Настройка Caddy на Alpine контейнере (192.168.100.101)

### 1.1. Подключение к Alpine контейнеру

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

    # API routes
    reverse_proxy /api/* 192.168.100.102:3000 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up Host {host}
    }

    # Controller proxy routes
    reverse_proxy /c/* 192.168.100.102:3000 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up Host {host}
    }

    # WebSocket tunnel
    reverse_proxy /tunnel 192.168.100.102:3000 {
        transport http {
            read_timeout 3600s
            write_timeout 3600s
        }
        header_up Connection {>Connection}
        header_up Upgrade {>Upgrade}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # Health check
    reverse_proxy /health 192.168.100.102:3000
}
```

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
cp .env.example .env
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

### 2.9. Создание необходимых директорий

```bash
mkdir -p logs/caddy backups
```

### 2.10. Использование docker-compose без Caddy

Так как Caddy уже работает на отдельном контейнере, используйте файл `docker-compose.prod-no-caddy.yml`:

```bash
# Используйте этот файл вместо docker-compose.prod.yml
cp docker-compose.prod-no-caddy.yml docker-compose.prod.yml
```

Или используйте напрямую:

```bash
docker compose -f docker-compose.prod-no-caddy.yml up -d
```

Файл `docker-compose.prod-no-caddy.yml` уже настроен правильно:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: wmoc-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-wmoc}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME:-wmoc_saas}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "127.0.0.1:5432:5432"  # Только локальный доступ
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-wmoc}"]
      interval: 10s
      timeout: 5s
      retries: 5
    command: >
      postgres
      -c shared_buffers=256MB
      -c max_connections=200
      -c effective_cache_size=1GB
      -c maintenance_work_mem=64MB
      -c checkpoint_completion_target=0.9
      -c wal_buffers=16MB
      -c default_statistics_target=100
      -c random_page_cost=1.1
      -c effective_io_concurrency=200
      -c work_mem=4MB
      -c min_wal_size=1GB
      -c max_wal_size=4GB

  redis:
    image: redis:7-alpine
    container_name: wmoc-redis
    restart: unless-stopped
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"  # Только локальный доступ
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: wmoc-api
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3000
      TUNNEL_PORT: 3001
      DATABASE_URL: postgresql://${DB_USER:-wmoc}:${DB_PASSWORD}@postgres:5432/${DB_NAME:-wmoc_saas}
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      CORS_ORIGIN: ${CORS_ORIGIN:-https://wmoc.online}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    ports:
      # Доступен из внутренней сети (для Caddy на 192.168.100.101)
      - "0.0.0.0:3000:3000"
      - "0.0.0.0:3001:3001"
    volumes:
      - ./logs:/app/logs
    networks:
      - default
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
```

> **Важно:** Порты 3000 и 3001 привязаны к `0.0.0.0`, чтобы Caddy мог к ним подключиться, но firewall ограничивает доступ только с IP Caddy.

### 2.11. Сборка и запуск контейнеров

```bash
# Собрать образы
docker compose -f docker-compose.prod-no-caddy.yml build

# Запустить все сервисы
docker compose -f docker-compose.prod-no-caddy.yml up -d

# Проверить статус
docker compose -f docker-compose.prod-no-caddy.yml ps

# Просмотр логов
docker compose -f docker-compose.prod-no-caddy.yml logs -f
```

### 2.12. Применение миграций базы данных

```bash
# Скопировать SQL файл в контейнер
docker cp src/database/migrations/001_initial_schema.sql wmoc-postgres:/tmp/

# Выполнить миграцию
docker compose -f docker-compose.prod-no-caddy.yml exec postgres psql -U wmoc -d wmoc_saas -f /tmp/001_initial_schema.sql
```

Или вручную через psql:

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U wmoc -d wmoc_saas

# Затем выполните SQL из файла src/database/migrations/001_initial_schema.sql
```

### 2.13. Проверка работы

```bash
# Проверить health endpoint напрямую
curl http://192.168.100.102:3000/health

# Проверить через Caddy (должен быть настроен DNS)
curl https://wmoc.online/health

# Проверить логи API
docker compose -f docker-compose.prod.yml logs -f api
```

---

## Шаг 3: Настройка DNS

Убедитесь, что DNS записи настроены:

```
A     wmoc.online        → внешний-ip-адрес-роутера
A     *.wmoc.online      → внешний-ip-адрес-роутера
```

Роутер должен пробрасывать порты 80 и 443 на `192.168.100.101` (Alpine контейнер с Caddy).

---

## Шаг 4: Проверка SSL

После первого запроса к `https://wmoc.online`, Caddy автоматически:
1. Получит SSL сертификат от Let's Encrypt
2. Настроит HTTPS
3. Начнёт обслуживать запросы

Проверить можно:

```bash
# На Alpine контейнере (192.168.100.101)
tail -f /var/log/caddy/access.log

# Проверить сертификат
curl -I https://wmoc.online
```

---

## Управление сервисами

### Просмотр логов

```bash
# Все сервисы
docker compose -f docker-compose.prod-no-caddy.yml logs -f

# Конкретный сервис
docker compose -f docker-compose.prod-no-caddy.yml logs -f api
docker compose -f docker-compose.prod-no-caddy.yml logs -f postgres
```

### Перезапуск сервисов

```bash
# Перезапустить все
docker compose -f docker-compose.prod-no-caddy.yml restart

# Перезапустить конкретный сервис
docker compose -f docker-compose.prod-no-caddy.yml restart api
```

### Остановка и запуск

```bash
# Остановить
docker compose -f docker-compose.prod-no-caddy.yml down

# Запустить
docker compose -f docker-compose.prod-no-caddy.yml up -d
```

### Обновление приложения

```bash
cd ~/wmoc-server/server

# Получить последние изменения
git pull

# Пересобрать и перезапустить
docker compose -f docker-compose.prod-no-caddy.yml up -d --build

# Применить новые миграции (если есть)
# docker compose -f docker-compose.prod-no-caddy.yml exec postgres psql -U wmoc -d wmoc_saas -f /tmp/new_migration.sql
```

---

## Резервное копирование

### Бэкап базы данных

```bash
# Создать бэкап
docker compose -f docker-compose.prod-no-caddy.yml exec postgres pg_dump -U wmoc wmoc_saas > backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Автоматический бэкап (добавить в crontab)
# 0 2 * * * cd /home/wmoc/wmoc-server/server && docker compose -f docker-compose.prod-no-caddy.yml exec -T postgres pg_dump -U wmoc wmoc_saas > backups/backup_$(date +\%Y\%m\%d_\%H\%M\%S).sql
```

### Восстановление из бэкапа

```bash
docker compose -f docker-compose.prod-no-caddy.yml exec -T postgres psql -U wmoc -d wmoc_saas < backups/backup_YYYYMMDD_HHMMSS.sql
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
curl http://192.168.100.102:3000/health

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
docker compose -f docker-compose.prod-no-caddy.yml ps

# Проверить логи
docker compose -f docker-compose.prod-no-caddy.yml logs api

# Проверить подключение к БД
docker compose -f docker-compose.prod-no-caddy.yml exec api ping postgres
```

### Caddy не может подключиться к API

```bash
# На Ubuntu сервере проверить доступность порта
sudo netstat -tulpn | grep 3000

# Проверить firewall
sudo ufw status

# Проверить с Alpine контейнера
# На 192.168.100.101:
curl http://192.168.100.102:3000/health
```

### Проблемы с SSL

```bash
# На Alpine контейнере проверить логи Caddy
tail -f /var/log/caddy/access.log

# Проверить конфигурацию
caddy validate --config /etc/caddy/Caddyfile
```

---

## Чеклист развёртывания

- [ ] Настроен Caddyfile на Alpine контейнере (192.168.100.101)
- [ ] Caddy перезагружен и работает
- [ ] Установлен Docker на Ubuntu (192.168.100.102)
- [ ] Настроен firewall (порты 3000/3001 только от Caddy)
- [ ] Клонирован репозиторий
- [ ] Настроен `.env` файл с секретами
- [ ] Используется `docker-compose.prod-no-caddy.yml` (без Caddy)
- [ ] Запущены контейнеры
- [ ] Применены миграции БД
- [ ] Проверен health endpoint
- [ ] Настроены DNS записи
- [ ] Проверен SSL сертификат
- [ ] Настроено резервное копирование

