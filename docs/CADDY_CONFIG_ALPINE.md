# Конфигурация Caddy для Alpine контейнера

## Расположение файлов

На Alpine контейнере с Caddy (192.168.100.101):

- Конфигурация: `/etc/caddy/Caddyfile`
- Логи: `/var/log/caddy/access.log`
- Данные SSL: `/var/lib/caddy/.local/share/caddy/certificates/`

## Полная конфигурация Caddyfile

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
        header_up Host {host}
    }

    # Health check
    reverse_proxy /health 192.168.100.102:3000
}
```

## Установка на Alpine

Если Caddy ещё не установлен:

```bash
# Установка Caddy
apk add --no-cache caddy

# Включить автозапуск
rc-update add caddy

# Запустить
rc-service caddy start
```

## Управление Caddy на Alpine

```bash
# Проверить конфигурацию
caddy validate --config /etc/caddy/Caddyfile

# Перезагрузить конфигурацию (без перезапуска)
caddy reload --config /etc/caddy/Caddyfile

# Перезапустить сервис
rc-service caddy restart

# Остановить
rc-service caddy stop

# Запустить
rc-service caddy start

# Статус
rc-service caddy status

# Логи
tail -f /var/log/caddy/access.log
```

## Проверка работы

```bash
# Проверить, что Caddy слушает порты
netstat -tulpn | grep caddy

# Должно показать:
# tcp  0  0  :::80   :::*  LISTEN  <pid>/caddy
# tcp  0  0  :::443  :::*  LISTEN  <pid>/caddy

# Проверить подключение к API серверу
curl http://192.168.100.102:3000/health

# Проверить через Caddy (если DNS настроен)
curl https://wmoc.online/health
```

## Получение SSL сертификата

Caddy автоматически получит SSL сертификат при первом запросе к `https://wmoc.online`.

Для проверки:

```bash
# Проверить логи получения сертификата
tail -f /var/log/caddy/access.log

# Проверить наличие сертификата
ls -la /var/lib/caddy/.local/share/caddy/certificates/
```

## Troubleshooting

### Caddy не может получить SSL сертификат

1. Проверьте DNS записи:
   ```bash
   nslookup wmoc.online
   ```

2. Проверьте, что порты 80 и 443 проброшены на роутере

3. Проверьте логи:
   ```bash
   tail -f /var/log/caddy/access.log
   ```

### Caddy не может подключиться к API

1. Проверьте доступность API:
   ```bash
   curl http://192.168.100.102:3000/health
   ```

2. Проверьте firewall на Ubuntu сервере:
   ```bash
   # На Ubuntu (192.168.100.102)
   sudo ufw status
   ```

3. Проверьте сетевую связность:
   ```bash
   ping 192.168.100.102
   ```




