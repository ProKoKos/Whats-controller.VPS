# Решение проблем локальной разработки

## Порт уже занят (EADDRINUSE)

Если при запуске возникает ошибка `Error: listen EADDRINUSE: address already in use :::3000`, значит порт уже занят другим процессом.

### Windows (PowerShell)

```powershell
# Найти процесс на порту 3000
netstat -ano | findstr :3000

# Остановить процесс по PID
Stop-Process -Id <PID> -Force

# Или использовать скрипт
.\scripts\kill-port.ps1 -Port 3000
```

### Остановить все сервисы проекта

```powershell
.\scripts\stop-all.ps1
```

## Проблемы с запуском start.ps1

### Синтаксическая ошибка в скрипте

Убедитесь что скрипт не повреждён. Если ошибка сохраняется, запустите напрямую:

```powershell
# Только Docker контейнеры
docker compose up -d postgres redis

# Backend отдельно
npm run dev

# Frontend отдельно (в другом терминале)
cd frontend
npm run dev
```

### Запуск через npm

```powershell
# Запуск backend и frontend одновременно
npm run dev:full
```

## Проблемы с Docker

### Docker Desktop не запущен

Убедитесь что Docker Desktop запущен перед использованием скрипта.

### Контейнеры не запускаются

```powershell
# Проверить статус
docker compose ps

# Посмотреть логи
docker compose logs postgres
docker compose logs redis

# Пересоздать контейнеры
docker compose down
docker compose up -d postgres redis
```

## Проблемы с базой данных

### База данных не готова

Подождите несколько секунд после запуска контейнеров. Скрипт автоматически ждёт готовности базы.

### Проверка подключения вручную

```powershell
docker compose exec postgres psql -U wmoc -d wmoc_saas -c "SELECT 1;"
```

## Проблемы с frontend

### Next.js не запускается

```powershell
cd frontend

# Очистить кэш
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

# Переустановить зависимости
npm install

# Запустить заново
npm run dev
```

### Порт 3001 занят

Измените порт в `frontend/package.json`:

```json
"dev": "next dev -p 3002"
```

И обновите `NEXT_PUBLIC_API_URL` в `.env.local` если необходимо.

