# Скрипт для остановки всех запущенных сервисов проекта

Write-Host "Остановка всех сервисов WMOC..." -ForegroundColor Yellow

# Остановка процессов на портах 3000 и 3001
Write-Host ""
Write-Host "Освобождение портов..." -ForegroundColor Cyan
& "$PSScriptRoot\kill-port.ps1" -Port 3000
& "$PSScriptRoot\kill-port.ps1" -Port 3001
& "$PSScriptRoot\kill-port.ps1" -Port 3002

# Остановка Docker контейнеров (опционально)
Write-Host ""
Write-Host "Остановка Docker контейнеров..." -ForegroundColor Cyan
docker compose stop

Write-Host ""
Write-Host "✓ Все сервисы остановлены" -ForegroundColor Green

