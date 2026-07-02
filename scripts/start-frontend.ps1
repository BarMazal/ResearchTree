param([switch]$NoWait)

$port = 5173
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
  Where-Object { $_.OwningProcess } |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }

if ($process) {
  Write-Host "Killing existing process on port $port (PID $($process.Id))..."
  $process | Stop-Process -Force
  Start-Sleep -Seconds 1
}

$frontendDir = Join-Path $PSScriptRoot "..\frontend"

if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
  Write-Host "Installing dependencies..."
  Push-Location $frontendDir
  try {
    npm install
  } finally {
    Pop-Location
  }
}

Write-Host "Starting frontend on http://127.0.0.1:$port ..."
$viteEntry = Join-Path $frontendDir "node_modules\vite\bin\vite.js"
if ($NoWait) {
  $proc = Start-Process -NoNewWindow -FilePath "node" -ArgumentList "`"$viteEntry`" --host 127.0.0.1 --port $port" -WorkingDirectory $frontendDir -PassThru
  Write-Host "  Frontend PID: $($proc.Id)"
  return $proc
} else {
  Push-Location $frontendDir
  try {
    node $viteEntry --host 127.0.0.1 --port $port
  } finally {
    Pop-Location
  }
}
