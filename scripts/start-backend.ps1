param([switch]$NoWait)

$port = 8010
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
  Where-Object { $_.OwningProcess } |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }

if ($process) {
  Write-Host "Killing existing process on port $port (PID $($process.Id))..."
  $process | Stop-Process -Force
  Start-Sleep -Seconds 1
}

$backendDir = Join-Path $PSScriptRoot "..\backend"
$venvDir = Join-Path $backendDir ".venv"

if (-not (Test-Path $venvDir)) {
  Write-Host "Creating virtual environment..."
  Push-Location $backendDir
  try {
    python -m venv .venv
  } finally {
    Pop-Location
  }
}

Write-Host "Starting backend on http://127.0.0.1:$port ..."
$python = Join-Path $venvDir "Scripts\python.exe"
if ($NoWait) {
  $proc = Start-Process -NoNewWindow -FilePath $python -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port $port --reload --log-level debug" -WorkingDirectory $backendDir -PassThru
  Write-Host "  Backend PID: $($proc.Id)"
  return $proc
} else {
  Push-Location $backendDir
  try {
    & $python -m uvicorn app.main:app --host 127.0.0.1 --port $port --reload --log-level debug
  } finally {
    Pop-Location
  }
}
