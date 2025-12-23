# Развёртывание с Caddy

## Архитектура с Caddy

```
┌─────────────────────────────────────────────────────────────┐
│                  Ubuntu Server (Хост)                        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Установлено напрямую в ОС:                        │    │
│  │  • Docker & Docker Compose                         │    │
│  │  • Git                                             │    │
│  │  • UFW (firewall)                                  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Docker контейнеры:                                 │    │
│  │                                                     │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │    │
│  │  │   Caddy      │  │   API        │  │ PostgreSQL│ │    │
│  │  │ (80/443)     │→ │  (3000)      │→ │  (5432)   │ │    │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │    │
│  │                        ↑                            │    │
│  │  ┌──────────────┐     │                            │    │
│  │  │   Redis      │─────┘                            │    │
│  │  │  (6379)      │                                  │    │
│  │  └──────────────┘                                  │    │
│  │                                                     │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS (443)
                            ↓
              ┌─────────────────────────────┐
              │         Интернет            │
              └─────────────────────────────┘
```

## Преимущества использования Caddy

### ✅ Не нужно устанавливать на хост:
- ❌ Nginx
- ❌ Certbot
- ❌ Настройка SSL сертификатов вручную

### ✅ Всё в Docker:
- Caddy в контейнере
- Автоматический SSL (Let's Encrypt)
- Единое управление через docker-compose

## Установка

### 1. Минимальная установка на хост

```bash
# Только Docker и Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Git (для клонирования)
sudo apt install -y git

# Firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 443/udp   # HTTP/3 (QUIC)
sudo ufw enable
```

### 2. Клонирование и настройка

```bash
cd ~
git clone https://github.com/ProKoKos/Whats-controller.VPS.git wmoc-server
cd wmoc-server/server
cp .env.example .env
# Отредактируйте .env
```

### 3. Настройка DNS

Убедитесь, что DNS записи настроены:
```
A     wmoc.online        → ваш-ip-адрес
A     *.wmoc.online      → ваш-ip-адрес
```

### 4. Запуск всех сервисов

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

Caddy автоматически:
- Получит SSL сертификат от Let's Encrypt
- Настроит HTTPS
- Начнёт проксировать запросы

### 5. Применение миграций БД

```bash
docker-compose -f docker-compose.prod.yml exec postgres psql -U wmoc -d wmoc_saas -f /tmp/migrations/001_initial_schema.sql
```

Или вручную:
```bash
# Скопировать SQL файл в контейнер
docker cp src/database/migrations/001_initial_schema.sql wmoc-postgres:/tmp/

# Выполнить миграцию
docker-compose -f docker-compose.prod.yml exec postgres psql -U wmoc -d wmoc_saas -f /tmp/001_initial_schema.sql
```

## Конфигурация Caddy

Файл `Caddyfile` содержит всю конфигурацию:

```caddy
wmoc.online {
    # API routes
    reverse_proxy /api/* localhost:3000
    
    # Controller proxy
    reverse_proxy /c/* localhost:3000
    
    # WebSocket tunnel
    reverse_proxy /tunnel localhost:3000 {
        transport http {
            read_timeout 3600s
            write_timeout 3600s
        }
    }
}
```

Caddy автоматически:
- Настроит SSL для `wmoc.online`
- Сделает HTTP → HTTPS редирект
- Включит HTTP/2 и HTTP/3

## Проверка работы

### Проверить SSL сертификат

```bash
# Посмотреть логи Caddy
docker-compose -f docker-compose.prod.yml logs caddy

# Проверить сертификат через curl
curl -I https://wmoc.online
```

### Проверить доступность API

```bash
curl https://wmoc.online/health
```

## Обновление конфигурации

После изменения `Caddyfile`:

```bash
# Перезагрузить Caddy
docker-compose -f docker-compose.prod.yml restart caddy

# Или перечитать конфиг без перезапуска (если поддерживается)
docker-compose -f docker-compose.prod.yml exec caddy caddy reload --config /etc/caddy/Caddyfile
```

## Логи

Логи Caddy доступны в:
- Контейнере: `/var/log/caddy/access.log`
- На хосте: `./logs/caddy/access.log` (если volume смонтирован)

Просмотр в реальном времени:
```bash
docker-compose -f docker-compose.prod.yml logs -f caddy
```

## Резервное копирование

Важные данные Caddy хранятся в volume `caddy_data`:
- SSL сертификаты
- Ключи Let's Encrypt

Бэкап:
```bash
docker run --rm -v wmoc_caddy_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/caddy_data_backup.tar.gz -C /data .
```

Восстановление:
```bash
docker run --rm -v wmoc_caddy_data:/data -v $(pwd)/backups:/backup alpine sh -c "cd /data && tar xzf /backup/caddy_data_backup.tar.gz"
```

## Сравнение: Caddy vs Nginx

| Параметр | Caddy | Nginx |
|----------|-------|-------|
| **SSL настройка** | Автоматическая | Ручная (Certbot) |
| **Конфигурация** | Простая | Сложнее |
| **HTTP/3** | Из коробки | Требует настройки |
| **Размер образа** | ~40MB | ~50MB |
| **Производительность** | Хорошая | Отличная |
| **Зрелость** | Моложе | Зрелее |
| **Сообщество** | Меньше | Огромное |

**Для WMOC SaaS: Caddy - оптимальный выбор** ✅

## Что НЕ используем: Docker-in-Docker

❌ **НЕ запускаем Docker внутри контейнера Alpine**

Вместо этого:
- ✅ Все контейнеры (Caddy, API, PostgreSQL, Redis) на одном уровне
- ✅ Управление через docker-compose на хосте
- ✅ Простая, безопасная архитектура

См. `docs/DOCKER_IN_DOCKER.md` для подробностей почему DinD не рекомендуется.

