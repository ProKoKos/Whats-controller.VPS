# Быстрый старт локальной разработки

## 1. Подготовка

### Остановить процессы на портах (если заняты)

```powershell
# Остановить все сервисы проекта
.\scripts\stop-all.ps1

# Или освободить порты вручную
.\scripts\kill-port.ps1 -Port 3000
.\scripts\kill-port.ps1 -Port 3001
```

### Запустить Docker Desktop

Убедитесь что Docker Desktop запущен.

## 2. Запуск проекта

### Вариант 1: Единый скрипт (рекомендуется)

```powershell
.\start.ps1
```

Этот скрипт:
- Запустит Docker контейнеры (PostgreSQL, Redis)
- Подождёт готовности базы данных
- Запустит Backend (порт 3000) и Frontend (порт 3001)

### Вариант 2: Ручной запуск

```powershell
# 1. Запустить Docker контейнеры
docker compose up -d postgres redis

# 2. Дождаться готовности БД (10-15 секунд)

# 3. Запустить backend и frontend одновременно
npm run dev:full
```

### Вариант 3: Раздельный запуск

**Терминал 1 - Backend:**
```powershell
npm run dev
```

**Терминал 2 - Frontend:**
```powershell
cd frontend
npm run dev
```

## 3. Доступ к приложению

- **Frontend:** http://localhost:3001
- **Backend API:** http://localhost:3000
- **Health check:** http://localhost:3000/health

## 4. Остановка

Нажмите `Ctrl+C` в терминале где запущен скрипт/сервисы.

Для полной остановки всех сервисов:
```powershell
.\scripts\stop-all.ps1
```

## Решение проблем

См. [LOCAL_TROUBLESHOOTING.md](./docs/LOCAL_TROUBLESHOOTING.md)

