# Скрипт для освобождения порта

param(
    [Parameter(Mandatory=$true)]
    [ValidateRange(1, 65535)]
    [int]$Port
)

Write-Host "Поиск процессов на порту $Port..." -ForegroundColor Yellow

$connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

if ($connections) {
    $processes = $connections | Select-Object -Unique -ExpandProperty OwningProcess
    foreach ($processId in $processes) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Найден процесс: $($process.ProcessName) (PID: $processId)" -ForegroundColor Cyan
            try {
                $process.Kill()
                Write-Host "   Процесс остановлен" -ForegroundColor Green
            }
            catch {
                Write-Host "   Не удалось остановить процесс (возможно, недостаточно прав)" -ForegroundColor Yellow
            }
        }
    }
}
else {
    Write-Host "Порт $Port свободен" -ForegroundColor Green
}
