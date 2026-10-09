# ==============================================================================
# archive_code_and_files.ps1
#
# Standalone archiving script for ResearchTree.
# 1. Detects & prompts for Python installation choice (sorted newest first).
# 2. Creates temporary backend/collections_archive & research_tree_archive.db.
# 3. Inspects database items for local file references outside storage, copies
#    physical files into collections_archive, and updates DB records.
# 4. Archives codebase and temporary duplications into ResearchTree_archive.zip
#    excluding .venv, node_modules, live collections, and live research_tree.db.
# 5. Cleans up temporary staging items.
# ==============================================================================

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
$rootDir = (Resolve-Path "$scriptDir\..").Path
Set-Location $rootDir

$pyCmd = Get-PythonExecutable

& $pyCmd "$PSScriptRoot\_archive_helper.py"
