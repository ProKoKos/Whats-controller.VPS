# Скрипт для запуска всего проекта в режиме разработки (PowerShell)

Write-Host "🚀 Запуск WMOC SaaS Platform в режиме разработки..." -ForegroundColor Cyan

# Проверка что Docker запущен
try {
    docker ps | Out-Null
} catch {
    Write-Host "❌ Docker не запущен. Запустите Docker Desktop." -ForegroundColor Red
    exit 1
}

# Запуск PostgreSQL и Redis
Write-Host "📦 Запуск Docker контейнеров (PostgreSQL, Redis)..." -ForegroundColor Yellow
docker compose up -d postgres redis

# Ожидание готовности БД
Write-Host "⏳ Ожидание готовности базы данных..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "✅ Docker контейнеры запущены" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Запуск сервисов:" -ForegroundColor Cyan
Write-Host "   - Backend API будет на http://localhost:3000"
Write-Host "   - Frontend будет на http://localhost:3001"
Write-Host ""
Write-Host "Для запуска backend: npm run dev" -ForegroundColor White
Write-Host "Для запуска frontend: cd frontend && npm run dev -- -p 3001" -ForegroundColor White
Write-Host "Или используйте: npm run dev:full (запускает оба одновременно)" -ForegroundColor White
Write-Host ""

