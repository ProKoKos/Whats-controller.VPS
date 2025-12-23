# Установка и настройка WMOC SaaS Platform

## Требования

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (опционально, для упрощённого развёртывания)

## Вариант 1: Локальная установка

### 1. Установка зависимостей

```bash
cd server
npm install
```

### 2. Настройка базы данных

Создайте базу данных PostgreSQL:

```sql
CREATE DATABASE wmoc_saas;
CREATE USER wmoc WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE wmoc_saas TO wmoc;
```

### 3. Настройка Redis

Убедитесь, что Redis запущен на порту 6379.

### 4. Настройка переменных окружения

Скопируйте `.env.example` в `.env` и заполните значения:

```bash
cp .env.example .env
```

Отредактируйте `.env`:

```env
DATABASE_URL=postgresql://wmoc:password@localhost:5432/wmoc_saas
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-very-secret-jwt-key
```

### 5. Выполнение миграций

```bash
# Применить миграции
psql -U wmoc -d wmoc_saas -f src/database/migrations/001_initial_schema.sql
```

### 6. Запуск приложения

```bash
# Режим разработки
npm run dev

# Или сборка и запуск
npm run build
npm start
```

## Вариант 2: Docker Compose

### 1. Клонирование и настройка

```bash
cd server
cp .env.example .env
# Отредактируйте .env
```

### 2. Запуск

```bash
docker-compose up -d
```

### 3. Применение миграций

```bash
docker-compose exec postgres psql -U wmoc -d wmoc_saas -f /path/to/001_initial_schema.sql
```

Или вручную через psql:

```bash
docker-compose exec postgres psql -U wmoc -d wmoc_saas
# Затем выполните SQL из миграции
```

## Настройка Nginx

Создайте конфигурацию `/etc/nginx/sites-available/wmoc.online`:

```nginx
upstream api_backend {
    server localhost:3000;
}

server {
    listen 80;
    server_name wmoc.online *.wmoc.online;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wmoc.online *.wmoc.online;

    ssl_certificate /etc/letsencrypt/live/wmoc.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wmoc.online/privkey.pem;

    # API routes
    location /api/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket tunnel
    location /tunnel {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Controller proxy (example: /c/{controllerId})
    location ~ ^/c/([^/]+)(/.*)?$ {
        set $controller_id $1;
        set $path $2;
        
        # TODO: Реализовать проксирование через TunnelService
        # Это требует дополнительной реализации в коде
        
        proxy_pass http://api_backend/proxy/$controller_id$path;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend (будет добавлено позже)
    location / {
        # TODO: Добавить статические файлы или проксирование к frontend серверу
        return 404;
    }
}
```

Активируйте конфигурацию:

```bash
sudo ln -s /etc/nginx/sites-available/wmoc.online /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Настройка SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d wmoc.online -d *.wmoc.online
```

Certbot автоматически обновит конфигурацию Nginx и настроит автообновление сертификатов.

## Проверка работы

1. Проверьте health endpoint: `curl https://wmoc.online/health`
2. Зарегистрируйте пользователя: `POST https://wmoc.online/api/auth/register`
3. Войдите в систему: `POST https://wmoc.online/api/auth/login`

## Следующие шаги

- Настройка frontend приложения
- Реализация HTTP proxy для контроллеров
- Настройка мониторинга и логирования
- Настройка уведомлений

