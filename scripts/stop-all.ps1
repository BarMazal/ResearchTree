@(8010, 5173) | ForEach-Object {
  $port = $_
  $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Where-Object { $_.OwningProcess } |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }

  if ($process) {
    Write-Host "Killing process on port $port (PID $($process.Id))..."
    $process | Stop-Process -Force
  } else {
    Write-Host "No process on port $port"
  }
}

# Fallback: kill known dev server command lines if they are between reload cycles.
$fallback = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object {
    ($_.CommandLine -like "*uvicorn app.main:app*--port 8010*") -or
    ($_.CommandLine -like "*node_modules\\vite\\bin\\vite.js*--port 5173*")
  }

if ($fallback) {
  $ids = $fallback | Select-Object -ExpandProperty ProcessId -Unique
  Write-Host "Killing fallback dev server processes (PID $($ids -join ', '))..."
  $ids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}

Write-Host "Done."
