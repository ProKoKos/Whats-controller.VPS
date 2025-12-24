# Локальная разработка и тестирование

Инструкция для полного локального запуска проекта WMOC для разработки и тестирования.

## Требования

- Node.js 20+ и npm
- Docker и Docker Compose
- Git

## Быстрый старт (рекомендуется)

### Единый скрипт запуска

**Windows:**
```powershell
# Из корня проекта (папка server)
.\start.ps1

# Или через npm
npm run start:all
```

**Linux/Mac:**
```bash
# Сделать скрипт исполняемым (один раз)
chmod +x start.sh

# Запуск
./start.sh
```

Скрипт автоматически:
1. ✅ Проверит что Docker запущен
2. ✅ Запустит Docker контейнеры (PostgreSQL, Redis)
3. ✅ Дождётся готовности базы данных
4. ✅ Запустит Backend API (порт 3000)
5. ✅ Запустит Frontend (порт 3001)

**Пропустить запуск Docker** (если контейнеры уже запущены):
```powershell
.\start.ps1 -SkipDocker
```

```bash
./start.sh --skip-docker
```

### Альтернативно: запуск по отдельности

### 1. Подготовка Backend

```bash
# Перейти в папку server
cd server

# Скопировать .env.example в .env (если есть) или создать .env
# Убедитесь, что в .env указаны:
# - DATABASE_URL
# - JWT_SECRET
# - DB_PASSWORD
# - DB_USER
# - DB_NAME
# - REDIS_URL
```

Пример `.env` для локальной разработки:

```env
NODE_ENV=development
PORT=3000
TUNNEL_PORT=3001

# Database
DATABASE_URL=postgresql://wmoc:password@localhost:5432/wmoc_saas
DB_USER=wmoc
DB_PASSWORD=password
DB_NAME=wmoc_saas

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3001

# Logging
LOG_LEVEL=debug
```

### 2. Запуск Backend (Docker)

```bash
# В папке server

# Запустить PostgreSQL и Redis в Docker
docker compose up -d postgres redis

# Дождаться готовности БД (около 10 секунд)
# Проверить статус
docker compose ps

# Применить миграции БД
docker cp src/database/migrations/001_initial_schema.sql wmoc-postgres:/tmp/
docker compose exec postgres psql -U wmoc -d wmoc_saas -f /tmp/001_initial_schema.sql

# Установить зависимости (если ещё не установлены)
npm install

# Собрать TypeScript
npm run build

# Запустить API сервер
npm start
# или для разработки с hot-reload:
npm run dev
```

Backend будет доступен на: `http://localhost:3000`

### 3. Подготовка Frontend

```bash
# В папке server/frontend

# Установить зависимости (если ещё не установлены)
npm install

# Создать .env.local для локальной разработки
# (опционально, по умолчанию будет использоваться http://localhost:3000/api)
```

Пример `.env.local`:

```env
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### 4. Запуск Frontend

```bash
# В папке server/frontend

# Запустить dev сервер
npm run dev -- -p 3001
```

Frontend будет доступен на: `http://localhost:3001`

### 5. Проверка работы

1. Откройте браузер: `http://localhost:3001`
2. Проверьте главную страницу
3. Перейдите на `/register` и создайте тестового пользователя
4. Перейдите на `/login` и войдите

## Полная инструкция (подробная)

### Шаг 1: Клонирование и настройка

```bash
# Клонировать репозиторий (если ещё не клонирован)
git clone https://github.com/ProKoKos/Whats-controller.VPS.git wmoc
cd wmoc/server
```

### Шаг 2: Настройка переменных окружения Backend

```bash
# Создать .env файл
cp .env.example .env  # Если есть пример
# или создать вручную

# Отредактировать .env
nano .env  # или используйте любой редактор
```

### Шаг 3: Запуск инфраструктуры (PostgreSQL + Redis)

```bash
# Запустить только БД и Redis (без API, так как запустим локально)
docker compose up -d postgres redis

# Проверить что контейнеры запущены
docker compose ps

# Должны быть:
# - wmoc-postgres (healthy)
# - wmoc-redis (healthy)
```

### Шаг 4: Настройка базы данных

```bash
# Скопировать SQL миграцию в контейнер
docker cp src/database/migrations/001_initial_schema.sql wmoc-postgres:/tmp/

# Применить миграцию
docker compose exec postgres psql -U wmoc -d wmoc_saas -f /tmp/001_initial_schema.sql

# Проверить что таблицы созданы
docker compose exec postgres psql -U wmoc -d wmoc_saas -c "\dt"
```

### Шаг 5: Установка зависимостей Backend

```bash
# В папке server
npm install
```

### Шаг 6: Запуск Backend API

```bash
# Вариант 1: Production режим
npm run build
npm start

# Вариант 2: Development режим (с hot-reload)
npm run dev

# API будет доступен на http://localhost:3000
# Проверить health: http://localhost:3000/health
```

### Шаг 7: Установка зависимостей Frontend

```bash
# В папке server/frontend
cd frontend
npm install
```

### Шаг 8: Настройка Frontend

```bash
# Создать .env.local (опционально)
cat > .env.local << EOF
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3000/api
EOF
```

### Шаг 9: Запуск Frontend

```bash
# В папке server/frontend
npm run dev -- -p 3001

# Frontend будет доступен на http://localhost:3001
```

### Шаг 10: Тестирование

1. **Главная страница**: http://localhost:3001/
2. **Регистрация**: http://localhost:3001/register
   - Введите email и пароль (минимум 8 символов)
   - Проверьте что регистрация проходит успешно
3. **Вход**: http://localhost:3001/login
   - Войдите с созданными учётными данными
   - Проверьте что токены сохраняются

## Проверка работоспособности

### Backend Health Check

```bash
curl http://localhost:3000/health
# Должен вернуть: {"status":"ok","timestamp":"..."}
```

### Проверка базы данных

```bash
# Посмотреть всех пользователей
docker compose exec postgres psql -U wmoc -d wmoc_saas -c "SELECT id, email, created_at FROM users;"
```

### Проверка Redis

```bash
# Подключиться к Redis
docker compose exec redis redis-cli ping
# Должно вернуть: PONG
```

## Остановка

```bash
# Остановить frontend: Ctrl+C в терминале где запущен npm run dev

# Остановить backend: Ctrl+C в терминале где запущен npm start/dev

# Остановить Docker контейнеры
cd server
docker compose down

# Или остановить только БД и Redis (оставить запущенными)
docker compose stop postgres redis
```

## Очистка (удалить все данные)

```bash
# В папке server

# Остановить контейнеры
docker compose down

# Удалить volumes (все данные БД)
docker compose down -v

# Запустить заново
docker compose up -d postgres redis
# Повторить шаг 4 (настройка БД)
```

## Устранение проблем

### Порт 3000 уже занят

Если порт 3000 занят другим приложением:

**Backend:**
- Измените `PORT=3000` в `.env` на другой порт (например, `PORT=3002`)
- Обновите `NEXT_PUBLIC_API_URL` во frontend `.env.local`

**Frontend:**
- Используйте другой порт: `npm run dev -- -p 3002`

### БД не подключается

```bash
# Проверить что контейнер запущен
docker compose ps

# Проверить логи
docker compose logs postgres

# Проверить переменные окружения
docker compose exec postgres env | grep POSTGRES
```

### Frontend не подключается к API

1. Проверьте что backend запущен: `curl http://localhost:3000/health`
2. Проверьте `NEXT_PUBLIC_API_URL` в `.env.local`
3. Проверьте консоль браузера на ошибки CORS
4. Убедитесь что `CORS_ORIGIN` в backend `.env` включает `http://localhost:3001`

### Ошибки TypeScript при сборке

```bash
# Очистить кэш и пересобрать
cd server
rm -rf dist node_modules
npm install
npm run build
```

## Полезные команды

```bash
# Посмотреть логи backend
cd server
npm run dev  # логи в консоли

# Посмотреть логи frontend
cd server/frontend
npm run dev  # логи в консоли

# Посмотреть логи Docker
docker compose logs -f postgres redis

# Перезапустить контейнеры
docker compose restart postgres redis

# Посмотреть использование ресурсов
docker stats
```

## Структура портов

- **3000** - Backend API
- **3001** - Frontend (Next.js dev server)
- **5432** - PostgreSQL (localhost, проброшен из контейнера)
- **6379** - Redis (localhost, проброшен из контейнера)

## Следующие шаги

После успешного локального запуска можно:

1. Разрабатывать новые функции
2. Тестировать API endpoints
3. Создавать новые страницы frontend
4. Работать над интеграцией frontend и backend

См. [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) для плана разработки.

