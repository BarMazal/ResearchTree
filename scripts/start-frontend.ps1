param([switch]$NoWait)

$port = 5173
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
  Where-Object { $_.OwningProcess } |
  ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue }

if ($process) {
  Write-Host "Killing existing process on port $port (PID $($process.Id))..."
  $process | Stop-Process -Force
  Start-Sleep -Seconds 1
}

Set-Location "$PSScriptRoot\..\frontend"

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies..."
  npm install
}

Write-Host "Starting frontend on http://127.0.0.1:$port ..."
if ($NoWait) {
  Start-Process -NoNewWindow -FilePath "npx.cmd" -ArgumentList "vite --host 127.0.0.1 --port $port"
} else {
  npx vite --host 127.0.0.1 --port $port
}
