# Архитектура WMOC SaaS Platform

## Общая схема работы

### Регистрация и активация контроллера

1. **Первый запуск контроллера:**
   ```
   ESP32 → Подключение к WiFi
   ESP32 → Отображение QR-кода/страницы активации
   Пользователь → Сканирует QR / вводит данные на портале
   Пользователь → Авторизация на wmoc.online
   Пользователь → Получает токен активации
   ESP32 → WebSocket подключение с токеном активации
   Backend → Проверка токена → Регистрация контроллера
   Backend → Привязка к пользователю
   ESP32 → Сохранение credentials → Активация
   ```

2. **Последующие подключения:**
   ```
   ESP32 → WebSocket с сохранёнными credentials
   Backend → Проверка → Установка туннеля
   Пользователь → Доступ через wmoc.online/c/{controllerId}
   ```

### Маршрутизация запросов

**Для пользователя:**
- `https://wmoc.online` - Frontend Portal
- `https://wmoc.online/api/*` - Backend API
- `https://wmoc.online/c/{controllerId}/*` - Проксирование к контроллеру

**Для контроллера:**
- `wss://wmoc.online/tunnel` - WebSocket endpoint для туннеля

## Компоненты системы

### 1. Backend API Service

**Эндпоинты:**

#### Авторизация
- `POST /api/auth/register` - Регистрация пользователя
- `POST /api/auth/login` - Вход
- `POST /api/auth/refresh` - Обновление токена
- `POST /api/auth/logout` - Выход

#### Управление контроллерами
- `GET /api/controllers` - Список контроллеров пользователя
- `POST /api/controllers/activate` - Активация нового контроллера
- `GET /api/controllers/:id` - Информация о контроллере
- `PUT /api/controllers/:id` - Обновление метаданных
- `DELETE /api/controllers/:id` - Удаление контроллера
- `POST /api/controllers/:id/commands` - Отправка команд

#### Мониторинг
- `GET /api/controllers/:id/status` - Статус контроллера
- `GET /api/controllers/:id/metrics` - Метрики
- `GET /api/controllers/:id/logs` - Логи

#### Уведомления
- `GET /api/notifications` - Список уведомлений
- `PUT /api/notifications/:id/read` - Отметить как прочитанное

### 2. WebSocket Tunnel Service

**Протокол обмена сообщениями:**

```typescript
// Контроллер → Сервер (при подключении)
{
  type: "register",
  token: "activation_token", // При первом подключении
  credentials: { mac, firmware_version, ... }, // При последующих
}

// Сервер → Контроллер
{
  type: "registered",
  controllerId: "uuid",
  status: "active"
}

// Сервер → Контроллер (HTTP запрос от пользователя)
{
  type: "http_request",
  id: "request_id",
  method: "GET",
  path: "/api/status",
  headers: {...},
  body: "..."
}

// Контроллер → Сервер (HTTP ответ)
{
  type: "http_response",
  id: "request_id",
  status: 200,
  headers: {...},
  body: "..."
}
```

### 3. Database Schema

#### Таблица `users`
```sql
id UUID PRIMARY KEY
email VARCHAR(255) UNIQUE
password_hash VARCHAR(255)
created_at TIMESTAMP
updated_at TIMESTAMP
subscription_tier VARCHAR(50) -- free, basic, premium
subscription_expires_at TIMESTAMP
```

#### Таблица `controllers`
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
mac_address VARCHAR(17) UNIQUE
firmware_version VARCHAR(50)
activation_token VARCHAR(255)
is_active BOOLEAN DEFAULT false
last_seen_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### Таблица `controller_sessions`
```sql
id UUID PRIMARY KEY
controller_id UUID REFERENCES controllers(id)
websocket_id VARCHAR(255)
connected_at TIMESTAMP
disconnected_at TIMESTAMP
```

#### Таблица `notifications`
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
type VARCHAR(50)
title VARCHAR(255)
message TEXT
is_read BOOLEAN DEFAULT false
created_at TIMESTAMP
```

#### Таблица `metrics`
```sql
id UUID PRIMARY KEY
controller_id UUID REFERENCES controllers(id)
metric_type VARCHAR(50)
value JSONB
timestamp TIMESTAMP
```

## Безопасность

### Авторизация
- JWT токены с коротким временем жизни (15 минут)
- Refresh токены для обновления
- Хеширование паролей (bcrypt)

### Контроллеры
- Уникальные MAC-адреса для идентификации
- Activation tokens с ограниченным сроком действия
- Авторизация на контроллере (базовая HTTP auth или токены)

### Туннелирование
- WebSocket over TLS (WSS)
- Проверка прав доступа перед проксированием
- Rate limiting на уровне Nginx и приложения

## Масштабирование

### Горизонтальное масштабирование
- Stateless backend сервисы (легко масштабируются)
- Shared Redis для сессий и кеша
- PostgreSQL с read replicas
- Load balancer перед backend сервисами

### Оптимизация
- Connection pooling для БД
- Кеширование частых запросов (Redis)
- Асинхронная обработка метрик и логов
- WebSocket соединения на отдельных инстансах

## Мониторинг и логирование

- Centralized logging (Winston + ELK или аналоги)
- Метрики (Prometheus + Grafana)
- Health checks для всех сервисов
- Алерты при недоступности контроллеров

