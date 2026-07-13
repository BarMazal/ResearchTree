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

# --- Python version selection ---
function Get-PythonVersions {
  $versions = @()
  $list = py --list 2>$null

  if (-not $list) {
    # Fallback: try 'python' command directly
    try {
      $exe = (Get-Command python.exe -ErrorAction Stop).Source
      $ver = & $exe --version 2>$null
      if ($ver) {
        $versions += @{ Version = "python"; Label = $ver.Trim(); Executable = $exe }
      }
    } catch {}
    return $versions
  }

  foreach ($line in $list) {
    $trimmed = $line.Trim()
    if ($trimmed -match '(-V:(\d+\.\d+))\s+\*?') {
      $flag = $matches[1]
      $ver = $matches[2]
      $isDefault = $trimmed -match '\*'
      $exe = & py $flag -c "import sys; print(sys.executable)" 2>$null
      if ($exe -and (Test-Path $exe)) {
        $versions += @{
          Version = $ver
          Label   = "Python $ver"
          Flag    = $flag
          IsDefault = $isDefault
          Executable = $exe
        }
      }
    }
  }

  return $versions
}

$versions = Get-PythonVersions
$selectedFlag = $null

if ($versions.Count -eq 0) {
  Write-Host "`nNo Python installation found." -ForegroundColor Red
  $answer = Read-Host "Would you like to install Python? (Y/n)"
  if ($answer -eq '' -or $answer.ToLower() -eq 'y') {
    Start-Process "https://www.python.org/downloads/"
    Write-Host "`nOpen the link above, download and install Python, then run this script again." -ForegroundColor Yellow
    Write-Host "Make sure to check 'Add Python to PATH' during installation." -ForegroundColor Yellow
    exit 1
  } else {
    Write-Host "Cannot start backend without Python." -ForegroundColor Red
    exit 1
  }
} else {
  if ($versions.Count -eq 1) {
    $selectedFlag = $versions[0].Flag
    Write-Host "`nUsing $($versions[0].Label)" -ForegroundColor DarkGray
  } else {
    $default = $versions | Where-Object { $_.IsDefault } | Select-Object -First 1
    if (-not $default) { $default = $versions[0] }

    Write-Host "`nAvailable Python versions:" -ForegroundColor Gray
    for ($i = 0; $i -lt $versions.Count; $i++) {
      $v = $versions[$i]
      $marker = if ($v.IsDefault) { " (*)" } else { "" }
      Write-Host "  [$($i+1)] $($v.Label) $($v.Executable)$marker"
    }
    Write-Host "`n  Default: [$($([array]::IndexOf($versions, $default) + 1))] $($default.Label)" -ForegroundColor Gray
    $input = Read-Host "  Select version [$(($versions.IndexOf($default) + 1))]"
    if ($input -eq '') {
      $selectedFlag = $default.Flag
    } elseif ($input -match '^\d+$' -and [int]$input -ge 1 -and [int]$input -le $versions.Count) {
      $selectedFlag = $versions[[int]$input - 1].Flag
    } else {
      $selectedFlag = $default.Flag
    }
  }
}

$python = Join-Path $venvDir "Scripts\python.exe"

if (-not (Test-Path $venvDir)) {
  Write-Host "`nCreating virtual environment..." -ForegroundColor DarkGray
  Push-Location $backendDir
  try {
    & py $selectedFlag -m venv .venv
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path (Join-Path $venvDir "Lib\site-packages\uvicorn"))) {
  Write-Host "Installing backend dependencies..." -ForegroundColor DarkGray
  Push-Location $backendDir
  & $python -m pip install -e . --quiet
  Pop-Location
}

Write-Host "Starting backend on http://127.0.0.1:$port ..."
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