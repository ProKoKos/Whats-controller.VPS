# Единый скрипт запуска WMOC SaaS Platform
# Запускает Docker контейнеры, Backend API и Frontend

param(
    [switch]$SkipDocker,
    [switch]$Docker
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "🚀 WMOC SaaS Platform - Запуск проекта" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверка Docker
if (-not $SkipDocker) {
    Write-Host "📦 Проверка Docker..." -ForegroundColor Yellow
    try {
        docker ps | Out-Null
        Write-Host "   ✓ Docker запущен" -ForegroundColor Green
    }
    catch {
        Write-Host "   ❌ Docker не запущен. Запустите Docker Desktop и повторите попытку." -ForegroundColor Red
        exit 1
    }

    # Запуск Docker контейнеров
    Write-Host ""
    Write-Host "📦 Запуск Docker контейнеров (PostgreSQL, Redis)..." -ForegroundColor Yellow
    docker compose up -d postgres redis

    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Ошибка при запуске Docker контейнеров" -ForegroundColor Red
        exit 1
    }

    Write-Host "   ✓ Контейнеры запущены" -ForegroundColor Green

    # Ожидание готовности контейнеров
    Write-Host ""
    Write-Host "⏳ Ожидание готовности базы данных..." -ForegroundColor Yellow
    $maxAttempts = 30
    $attempt = 0
    $dbReady = $false

    while ($attempt -lt $maxAttempts) {
        Start-Sleep -Seconds 2
        try {
            $null = docker compose exec -T postgres pg_isready -U wmoc 2>&1
            if ($LASTEXITCODE -eq 0) {
                $dbReady = $true
                break
            }
        }
        catch {
            # Продолжаем ожидание
        }
        $attempt++
        Write-Host "   ." -NoNewline -ForegroundColor Gray
    }

    if ($dbReady) {
        Write-Host ""
        Write-Host "   ✓ База данных готова" -ForegroundColor Green
    }
    else {
        Write-Host ""
        Write-Host "   ⚠️  База данных может быть ещё не готова, но продолжаем..." -ForegroundColor Yellow
    }
}
else {
    Write-Host "⏭️  Пропуск запуска Docker контейнеров (используйте -SkipDocker)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔧 Запуск сервисов..." -ForegroundColor Yellow
Write-Host ""
Write-Host "   Backend API:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "   Frontend:     http://localhost:3001" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Нажмите Ctrl+C для остановки всех сервисов" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Запуск через Docker Compose (продакшен) или npm (разработка)
if ($Docker) {
    Write-Host "🐳 Запуск через Docker Compose..." -ForegroundColor Yellow
    docker compose up api
}
else {
    # Проверка что npm установлен
    try {
        $null = npm --version
    }
    catch {
        Write-Host "❌ npm не найден. Установите Node.js или используйте: .\start.ps1 -Docker" -ForegroundColor Red
        exit 1
    }
    
    # Запуск backend и frontend одновременно (разработка)
    npm run dev:full
}

