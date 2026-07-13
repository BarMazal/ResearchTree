# 1. Ask if you want to commit your current workspace changes
Write-Host "Do you have new changes to stage and commit?" -ForegroundColor Cyan
$choice = Read-Host "Stage and commit changes now? (Y/N)"

if ($choice -eq 'y' -or $choice -eq 'Y' -or $choice -eq '') {
    # Prompt you for a custom commit message
    $msg = Read-Host "Enter your commit message"
    
    if ([string]::IsNullOrWhiteSpace($msg)) {
        Write-Host "Commit aborted: Message cannot be empty." -ForegroundColor Red
        exit 1
    }
    
    # Run the Git sequence safely
    git add .
    git commit -m $msg
    Write-Host "Changes successfully committed locally.`n" -ForegroundColor Green
}

# 2. Update local pointers and generate the patch file
Write-Host "Fetching latest master and generating patch..." -ForegroundColor Gray
git fetch origin master
git format-patch origin/master -o .

Write-Host "`nPatch generated successfully!" -ForegroundColor Green
