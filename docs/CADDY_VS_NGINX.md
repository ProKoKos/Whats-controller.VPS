# Caddy vs Nginx для WMOC SaaS

## Преимущества Caddy

### ✅ Автоматический SSL
- Встроенная поддержка Let's Encrypt (не нужен Certbot)
- Автоматическое обновление сертификатов
- HTTP → HTTPS редирект из коробки

### ✅ Простая конфигурация
- Минимальный конфиг для базового использования
- JSON или Caddyfile формат (более читаемый)

### ✅ Современные протоколы
- HTTP/2 и HTTP/3 из коробки
- WebSocket поддержка

### ✅ Docker-friendly
- Легко запускается в контейнере
- Официальный образ хорошо поддерживается

## Сравнение конфигураций

### Nginx (было)
```nginx
server {
    listen 443 ssl http2;
    server_name wmoc.online;
    
    ssl_certificate /etc/letsencrypt/live/wmoc.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wmoc.online/privkey.pem;
    
    location /api/ {
        proxy_pass http://api_backend;
        # ... много proxy_set_header
    }
}
```

### Caddy (станет)
```caddy
wmoc.online {
    reverse_proxy /api/* localhost:3000
    reverse_proxy /c/* localhost:3000
    reverse_proxy /tunnel localhost:3000 {
        transport http {
            read_timeout 3600s
            write_timeout 3600s
        }
    }
}
```

**Или JSON:**
```json
{
  "apps": {
    "http": {
      "servers": {
        "srv0": {
          "listen": [":443"],
          "routes": [
            {
              "match": [{"host": ["wmoc.online"]}],
              "handle": [
                {
                  "handler": "reverse_proxy",
                  "upstreams": [{"dial": "localhost:3000"}]
                }
              ]
            }
          ]
        }
      }
    }
  }
}
```

## Рекомендация: Caddy в Docker ✅

**Лучший вариант для данного проекта:**
- Caddy запускается в Docker контейнере
- Использует `network_mode: host` для доступа к портам 80/443
- Или пробрасывает порты 80:80, 443:443

**Преимущества:**
- ✅ Не нужно устанавливать Nginx и Certbot на хост
- ✅ Автоматический SSL без дополнительных инструментов
- ✅ Проще конфигурация
- ✅ Единое управление через docker-compose

