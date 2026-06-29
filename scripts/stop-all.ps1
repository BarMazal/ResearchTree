@(8000, 5173) | ForEach-Object {
  $port = $_
  $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Where-Object { $_.OwningProcess } |
    ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue }

  if ($process) {
    Write-Host "Killing process on port $port (PID $($process.Id))..."
    $process | Stop-Process -Force
  } else {
    Write-Host "No process on port $port"
  }
}
Write-Host "Done."
