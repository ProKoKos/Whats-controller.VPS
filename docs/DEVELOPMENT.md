# Руководство по разработке

## Структура проекта

```
server/
├── src/
│   ├── api/              # REST API routes
│   │   └── routes/
│   ├── tunnel/           # WebSocket tunnel service
│   ├── services/         # Бизнес-логика
│   ├── database/         # База данных (миграции, подключение)
│   ├── middleware/       # Express middleware
│   └── utils/            # Вспомогательные утилиты
├── docs/                 # Документация
├── logs/                 # Логи приложения (git-ignored)
└── dist/                 # Скомпилированный код (git-ignored)
```

## Разработка

### Запуск в режиме разработки

```bash
npm install
npm run dev
```

Приложение будет автоматически перезагружаться при изменении файлов.

### Компиляция TypeScript

```bash
npm run build
```

### Линтинг и форматирование

```bash
npm run lint
npm run format
```

## API Endpoints

### Авторизация

- `POST /api/auth/register` - Регистрация пользователя
- `POST /api/auth/login` - Вход в систему

### Управление контроллерами

- `GET /api/controllers` - Список контроллеров пользователя
- `POST /api/controllers/activate` - Активация нового контроллера
- `GET /api/controllers/:id` - Информация о контроллере
- `PUT /api/controllers/:id` - Обновление метаданных
- `DELETE /api/controllers/:id` - Удаление контроллера

### Проксирование к контроллерам

- `GET /c/:controllerId/*` - Проксирование HTTP запросов к контроллеру

### WebSocket

- `wss://wmoc.online/tunnel` - WebSocket endpoint для подключения контроллеров

## Работа с базой данных

### Применение миграций

```bash
psql -U wmoc -d wmoc_saas -f src/database/migrations/001_initial_schema.sql
```

### Создание новой миграции

Создайте файл `src/database/migrations/XXX_description.sql` и выполните его.

## Тестирование

```bash
npm test
```

## Переменные окружения

См. `.env.example` для списка всех доступных переменных окружения.

## Добавление нового функционала

1. Создайте новые routes в `src/api/routes/`
2. Добавьте бизнес-логику в `src/services/`
3. При необходимости создайте middleware в `src/middleware/`
4. Обновите документацию

## WebSocket протокол

### Сообщения от контроллера к серверу

**Регистрация:**
```json
{
  "type": "register",
  "token": "activation-token",  // При первой активации
  "mac": "AA:BB:CC:DD:EE:FF",   // При последующих подключениях
  "firmwareVersion": "1.0.0"
}
```

**HTTP ответ:**
```json
{
  "type": "http_response",
  "id": "request-id",
  "status": 200,
  "headers": {},
  "body": "..."
}
```

### Сообщения от сервера к контроллеру

**Регистрация подтверждена:**
```json
{
  "type": "registered",
  "controllerId": "uuid",
  "status": "active"
}
```

**HTTP запрос:**
```json
{
  "type": "http_request",
  "id": "request-id",
  "method": "GET",
  "path": "/api/status",
  "headers": {},
  "body": null
}
```

## Следующие шаги

- [ ] Реализация frontend приложения
- [ ] Добавление системы команд для контроллеров
- [ ] Реализация подписок и платежей
- [ ] Настройка мониторинга (Prometheus/Grafana)
- [ ] Централизованное логирование (ELK stack)
- [ ] Email/SMS уведомления
- [ ] WebSocket для real-time обновлений в frontend

