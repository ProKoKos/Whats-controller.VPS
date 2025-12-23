# Быстрый старт для продакшена

## Ваша инфраструктура

- **Alpine контейнер (192.168.100.101)**: Caddy reverse proxy
- **Ubuntu 24.04 (192.168.100.102)**: Приложение WMOC SaaS

## Шаг 1: Настройка Caddy на Alpine (192.168.100.101)

```bash
# Подключиться к контейнеру
ssh root@192.168.100.101

# Отредактировать Caddyfile
nano /etc/caddy/Caddyfile
```

**Содержимое Caddyfile:**

```caddy
wmoc.online {
    log {
        output file /var/log/caddy/access.log
        format json
    }
    
    reverse_proxy /api/* 192.168.100.102:3000 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up Host {host}
    }
    
    reverse_proxy /c/* 192.168.100.102:3000 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up Host {host}
    }
    
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
        header_up Host {host}
    }
    
    reverse_proxy /health 192.168.100.102:3000
}
```

```bash
# Перезагрузить Caddy
rc-service caddy reload
```

## Шаг 2: Настройка Ubuntu (192.168.100.102)

```bash
# Подключиться
ssh root@192.168.100.102

# Обновить систему
apt update && apt upgrade -y

# Установить Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Установить Git
apt install -y git

# Настроить firewall
ufw allow 22/tcp
ufw allow from 192.168.100.101 to any port 3000 proto tcp
ufw allow from 192.168.100.101 to any port 3001 proto tcp
ufw enable

# Клонировать репозиторий
cd ~
git clone https://github.com/ProKoKos/Whats-controller.VPS.git wmoc-server
cd wmoc-server/server

# Настроить .env
cp .env.example .env
nano .env  # Заполнить секреты

# Создать директории
mkdir -p logs backups

# Запустить контейнеры
docker compose -f docker-compose.prod-no-caddy.yml up -d --build

# Применить миграции
docker cp src/database/migrations/001_initial_schema.sql wmoc-postgres:/tmp/
docker compose -f docker-compose.prod-no-caddy.yml exec postgres psql -U wmoc -d wmoc_saas -f /tmp/001_initial_schema.sql

# Проверить
curl http://192.168.100.102:3000/health
```

## Проверка работы

```bash
# На Ubuntu
curl http://192.168.100.102:3000/health

# Через Caddy (если DNS настроен)
curl https://wmoc.online/health
```

## Полезные команды

```bash
# Логи
docker compose -f docker-compose.prod-no-caddy.yml logs -f

# Перезапуск
docker compose -f docker-compose.prod-no-caddy.yml restart

# Статус
docker compose -f docker-compose.prod-no-caddy.yml ps
```

## Полная инструкция

См. [DEPLOYMENT_PRODUCTION.md](DEPLOYMENT_PRODUCTION.md) для детальной инструкции.



