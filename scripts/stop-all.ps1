# Скрипт для остановки всех запущенных сервисов проекта

Write-Host "Остановка всех сервисов WMOC..." -ForegroundColor Yellow

# Остановка процессов на портах 3000, 3001, 3002
Write-Host ""
Write-Host "Освобождение портов..." -ForegroundColor Cyan

$scriptPath = $PSScriptRoot
if (-not $scriptPath) {
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$killPortScript = Join-Path $scriptPath "kill-port.ps1"
if (Test-Path $killPortScript) {
    & $killPortScript -Port 3000 -ErrorAction SilentlyContinue
    & $killPortScript -Port 3001 -ErrorAction SilentlyContinue
    & $killPortScript -Port 3002 -ErrorAction SilentlyContinue
}

# Остановка Docker контейнеров (опционально)
Write-Host ""
Write-Host "Остановка Docker контейнеров..." -ForegroundColor Cyan
docker compose stop 2>&1 | Out-Null

Write-Host ""
Write-Host "Все сервисы остановлены" -ForegroundColor Green
