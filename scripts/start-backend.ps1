param([switch]$NoWait)

$port = 8000
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
  Where-Object { $_.OwningProcess } |
  ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue }

if ($process) {
  Write-Host "Killing existing process on port $port (PID $($process.Id))..."
  $process | Stop-Process -Force
  Start-Sleep -Seconds 1
}

Set-Location "$PSScriptRoot\..\backend"

if (-not (Test-Path ".venv")) {
  Write-Host "Creating virtual environment..."
  python -m venv .venv
}

Write-Host "Starting backend on http://127.0.0.1:$port ..."
$python = ".\.venv\Scripts\python.exe"
if ($NoWait) {
  Start-Process -NoNewWindow -FilePath $python -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port $port --reload"
} else {
  & $python -m uvicorn app.main:app --host 127.0.0.1 --port $port --reload
}
