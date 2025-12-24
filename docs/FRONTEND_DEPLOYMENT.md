# Развёртывание Frontend на продакшене

Frontend (Next.js) развёрнут как отдельный Docker контейнер и работает на порту 3002.

## Обновление Caddy конфигурации

На сервере с Caddy (192.168.100.101) нужно обновить `/etc/caddy/Caddyfile`:

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

    # Frontend (Next.js) - catch-all для всех остальных запросов (must be last)
    handle {
        reverse_proxy 192.168.100.102:3002 {
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up Host {host}
        }
    }
}
```

После обновления конфигурации:

```bash
# Проверить конфигурацию
caddy validate --config /etc/caddy/Caddyfile

# Перезагрузить Caddy
caddy reload --config /etc/caddy/Caddyfile
```

## Настройка Firewall

На Ubuntu сервере (192.168.100.102) нужно открыть порт 3002 для Caddy:

```bash
sudo ufw allow from 192.168.100.101 to any port 3002 proto tcp
sudo ufw status
```

## Проверка работы

```bash
# Проверить что frontend контейнер работает
docker compose ps frontend

# Проверить логи frontend
docker compose logs frontend

# Проверить доступность локально
curl http://localhost:3002

# Проверить через Caddy (после обновления конфигурации)
curl https://wmoc.online
```

## Пересборка после изменений

После изменений в коде frontend:

```bash
cd ~/wmoc-server/server

# Обновить код
git pull

# Пересобрать frontend контейнер
docker compose build frontend

# Перезапустить frontend
docker compose up -d frontend
```

