param([string]$filename)

if (-not $filename) {
  Write-Host "Usage: .\apply_guest_patch.ps1 <filename>" -ForegroundColor Red
  exit 1
}

$errors = git apply --check --allow-empty $filename 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Patch check failed:" -ForegroundColor Red
  Write-Host $errors -ForegroundColor Red
  exit 1
}

git apply $filename