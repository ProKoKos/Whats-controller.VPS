# Быстрый старт развёртывания

## Краткая схема: Что где находится

```
┌─────────────────────────────────────────────────┐
│  Ubuntu Server (Хост)                           │
│                                                  │
│  ✅ Установлено в ОС:                           │
│     • Docker + Docker Compose                   │
│     • Nginx (reverse proxy на портах 80/443)    │
│     • Certbot (SSL сертификаты)                 │
│     • Git                                       │
│     • UFW (firewall)                            │
│                                                  │
│  🐳 В Docker контейнерах:                       │
│     • PostgreSQL (порт 5432, только localhost)  │
│     • Redis (порт 6379, только localhost)       │
│     • Node.js API (порты 3000/3001, localhost)  │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Что устанавливается в ОС

| Компонент | Зачем | Команда установки |
|-----------|-------|-------------------|
| **Docker** | Управление контейнерами | `curl -fsSL https://get.docker.com \| sh` |
| **Nginx** | Reverse proxy, SSL | `sudo apt install -y nginx` |
| **Certbot** | SSL сертификаты | `sudo apt install -y certbot python3-certbot-nginx` |
| **Git** | Клонирование кода | `sudo apt install -y git` |

## Что в Docker

| Компонент | Образ | Порт |
|-----------|-------|------|
| **PostgreSQL** | `postgres:15-alpine` | 5432 (localhost) |
| **Redis** | `redis:7-alpine` | 6379 (localhost) |
| **Node.js API** | Собственный (из Dockerfile) | 3000, 3001 (localhost) |

## Поток запросов

```
Интернет → Nginx (порт 443) → API контейнер (порт 3000)
                                    ↓
                          PostgreSQL контейнер
                          Redis контейнер
```

## Управление

```bash
# Запуск всех сервисов
docker-compose -f docker-compose.prod.yml up -d

# Остановка
docker-compose -f docker-compose.prod.yml down

# Логи
docker-compose -f docker-compose.prod.yml logs -f

# Перезапуск Nginx
sudo systemctl reload nginx
```

## Детали

См. `DEPLOYMENT_ARCHITECTURE.md` для полного описания архитектуры.

