# Скрипт для освобождения порта

param(
    [Parameter(Mandatory=$true)]
    [int]$Port
)

Write-Host "Поиск процессов на порту $Port..." -ForegroundColor Yellow

$connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

if ($connections) {
    $processes = $connections | Select-Object -Unique -ExpandProperty OwningProcess
    foreach ($pid in $processes) {
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Найден процесс: $($process.ProcessName) (PID: $pid)" -ForegroundColor Cyan
            $process.Kill()
            Write-Host "   ✓ Процесс остановлен" -ForegroundColor Green
        }
    }
} else {
    Write-Host "Порт $Port свободен" -ForegroundColor Green
}

