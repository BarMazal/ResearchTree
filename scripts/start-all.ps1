Write-Host "=== Starting Research Tree ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/2] Starting backend..." -ForegroundColor Yellow
& "$PSScriptRoot\start-backend.ps1" -NoWait

Write-Host "[2/2] Starting frontend..." -ForegroundColor Yellow
& "$PSScriptRoot\start-frontend.ps1" -NoWait

Write-Host ""
Write-Host "=== Both servers started ===" -ForegroundColor Green
Write-Host "  Backend:  http://127.0.0.1:8000"
Write-Host "  Frontend: http://127.0.0.1:5173"
Write-Host ""
Write-Host "Open http://127.0.0.1:5173 in your browser." -ForegroundColor Cyan
