# ==============================================================================
# setup_archived_code_and_files.ps1
#
# Standalone restoration & setup script for ResearchTree.
# 1. Detects & prompts for Python installation choice (sorted newest first).
# 2. Extracts ResearchTree_archive.zip if present.
# 3. Merges backend/collections_archive -> backend/collections
#    and research_tree_archive.db -> research_tree.db.
# 4. Supports -SilentOverride and -SilentDuplicate for conflict resolution.
# 5. Builds backend Python .venv and installs requirements.
# 6. Installs frontend npm packages.
# 7. Prints start instructions & setup usage options.
# ==============================================================================

param(
    [switch]$SilentOverride,
    [switch]$SilentDuplicate
)

$ErrorActionPreference = "Stop"

function Get-PythonExecutable {
    Write-Host "Detecting installed Python versions..." -ForegroundColor DarkGray
    $rawCandidates = [System.Collections.Generic.List[string]]::new()

    # 1. Search real Windows Python installation directories
    $searchPatterns = @(
        "$env:LocalAppData\Programs\Python\Python*\python.exe",
        "$env:ProgramFiles\Python*\python.exe",
        "C:\Python*\python.exe",
        "$env:SystemDrive\Python*\python.exe"
    )
    foreach ($pattern in $searchPatterns) {
        Get-Item $pattern -ErrorAction SilentlyContinue | ForEach-Object { $rawCandidates.Add($_.FullName) }
    }

    # 2. Add 'py' launcher
    $pyLauncher = Get-Command py -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    if ($pyLauncher) { $rawCandidates.Add($pyLauncher) }

    # 3. Add PATH 'python', excluding WindowsApps mock shims if possible
    $pathPy = Get-Command python -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    if ($pathPy -and $pathPy -notmatch "Microsoft\\WindowsApps") {
        $rawCandidates.Add($pathPy)
    }

    # 4. Filter valid executable paths
    $validPythons = @()
    $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

    foreach ($exe in $rawCandidates) {
        if (-not $exe -or $seen.Contains($exe)) { continue }
        [void]$seen.Add($exe)

        try {
            $ver = & $exe -c "import sys; print(sys.version.split()[0])" 2>&1
            if ($LASTEXITCODE -eq 0 -and $ver.ToString() -match "^\d+\.\d+") {
                $verStr = $ver.ToString().Trim()
                $validPythons += [PSCustomObject]@{
                    Path = $exe
                    VersionStr = $verStr
                    Version = "Python $verStr"
                }
            }
        } catch {
            # Ignore non-working paths
        }
    }

    if ($validPythons.Count -eq 0) {
        Write-Host "No working Python installation found automatically." -ForegroundColor Red
        $manual = Read-Host "Please enter the full path to python.exe"
        if (Test-Path $manual) { return $manual }
        throw "A working Python executable path is required to proceed."
    }

    # Sort candidates by version descending so modern versions (e.g. 3.12) are default
    $validPythons = @($validPythons | Sort-Object {
        try { [version]($_.VersionStr) } catch { [version]"0.0" }
    } -Descending)

    if ($validPythons.Count -eq 1) {
        Write-Host "Using Python: $($validPythons[0].Path) ($($validPythons[0].Version))" -ForegroundColor Green
        return $validPythons[0].Path
    }

    Write-Host ""
    Write-Host "Multiple Python installations detected:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $validPythons.Count; $i++) {
        $defaultTag = if ($i -eq 0) { " [DEFAULT]" } else { "" }
        Write-Host "  [$($i + 1)] $($validPythons[$i].Path) ($($validPythons[$i].Version))$defaultTag"
    }

    Write-Host ""
    $choice = ""
    if ([Environment]::UserInteractive) {
        $choice = Read-Host "Select Python executable [1-$($validPythons.Count)] (Press Enter for 1)"
    }
    if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }

    $index = 0
    if ([int]::TryParse($choice, [ref]$index) -and $index -ge 1 -and $index -le $validPythons.Count) {
        $selected = $validPythons[$index - 1].Path
        Write-Host "Selected Python: $selected" -ForegroundColor Green
        return $selected
    } else {
        Write-Host "Using default: $($validPythons[0].Path)" -ForegroundColor Green
        return $validPythons[0].Path
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$scriptLeaf = Split-Path $scriptDir -Leaf

if ($scriptLeaf -eq "ResearchTree_Bundle") {
    $parent = (Resolve-Path "$scriptDir\..").Path
    $parentLeaf = Split-Path $parent -Leaf
    if ($parentLeaf -eq "ResearchTree" -or (Test-Path "$parent\backend")) {
        $rootDir = $parent
    } else {
        $rootDir = Join-Path $parent "ResearchTree"
    }
} elseif ($scriptLeaf -eq "scripts") {
    $rootDir = (Resolve-Path "$scriptDir\..").Path
} else {
    $rootDir = (Resolve-Path "$scriptDir").Path
}

if (-not (Test-Path $rootDir)) {
    New-Item -ItemType Directory -Path $rootDir -Force | Out-Null
}
Set-Location $rootDir

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " ResearchTree - Restoring Archive and Setting Up " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Root Directory: $rootDir" -ForegroundColor DarkGray
Write-Host ""

$pyCmd = Get-PythonExecutable

$argsList = @()
if ($SilentOverride) { $argsList += "--silent_override" }
if ($SilentDuplicate) { $argsList += "--silent_duplicate" }

& $pyCmd "$PSScriptRoot\_setup_helper.py" @argsList

Write-Host ""
Write-Host "[STAGE 3/4] Setting up Python backend environment (.venv)..." -ForegroundColor Yellow
Set-Location "$rootDir\backend"

if (-not (Test-Path ".venv")) {
    Write-Host "Creating Python virtual environment (.venv)..." -ForegroundColor DarkGray
    & $pyCmd -m venv .venv
}

Write-Host "Installing backend packages..." -ForegroundColor DarkGray
& ".\.venv\Scripts\python.exe" -m pip install --upgrade pip setuptools --quiet 2>$null
& ".\.venv\Scripts\python.exe" -m pip install -e . --quiet

Write-Host ""
Write-Host "[STAGE 4/4] Installing frontend npm dependencies..." -ForegroundColor Yellow
Set-Location "$rootDir\frontend"
npm install --quiet

Set-Location $rootDir

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " Setup Complete! ResearchTree is Ready.          " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "To start both backend and frontend servers, run:" -ForegroundColor Cyan
Write-Host "  .\scripts\start-all.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "Usage Options for Setup Script (for reference):" -ForegroundColor Cyan
Write-Host "  1. Interactive (Default):  .\setup_archived_code_and_files.ps1" -ForegroundColor DarkGray
Write-Host "     Prompts for [D]uplicate, [O]verride, [S]kip, or [DA]/[OA]/[SA] for ALL collisions." -ForegroundColor DarkGray
Write-Host "  2. Silent Duplicate:       .\setup_archived_code_and_files.ps1 -SilentDuplicate" -ForegroundColor DarkGray
Write-Host "     Auto-duplicates conflicting items with new IDs & filenames." -ForegroundColor DarkGray
Write-Host "  3. Silent Override:        .\setup_archived_code_and_files.ps1 -SilentOverride" -ForegroundColor DarkGray
Write-Host "     Auto-overwrites conflicting records and files." -ForegroundColor DarkGray
Write-Host ""
