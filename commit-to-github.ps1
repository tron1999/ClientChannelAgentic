# PowerShell script to commit and push changes to GitHub
# Run this script after Git is installed and configured

Write-Host "=== GitHub Commit Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if git is available
try {
    $gitVersion = git --version
    Write-Host "Git found: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Git is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Git from https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "Then restart Cursor and run this script again." -ForegroundColor Yellow
    exit 1
}

# Check if repository is initialized
if (-not (Test-Path .git)) {
    Write-Host "Initializing git repository..." -ForegroundColor Yellow
    git init
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to initialize git repository" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Git repository already initialized" -ForegroundColor Green
}

# Check git config
Write-Host "`nChecking git configuration..." -ForegroundColor Cyan
$userName = git config --global user.name
$userEmail = git config --global user.email

if (-not $userName -or -not $userEmail) {
    Write-Host "WARNING: Git user name or email not configured" -ForegroundColor Yellow
    Write-Host "Please run:" -ForegroundColor Yellow
    Write-Host "  git config --global user.name `"Your Name`"" -ForegroundColor White
    Write-Host "  git config --global user.email `"your.email@example.com`"" -ForegroundColor White
    exit 1
} else {
    Write-Host "Git configured as: $userName <$userEmail>" -ForegroundColor Green
}

# Add all files
Write-Host "`nAdding files to git..." -ForegroundColor Cyan
git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to add files" -ForegroundColor Red
    exit 1
}
Write-Host "Files added successfully" -ForegroundColor Green

# Check if there are changes to commit
$status = git status --short
if (-not $status) {
    Write-Host "`nNo changes to commit" -ForegroundColor Yellow
    exit 0
}

# Commit changes
Write-Host "`nCommitting changes..." -ForegroundColor Cyan
$commitMessage = @"
Add comprehensive service execution logging system

- Added structured logging utility with service, action, and level tracking
- Implemented logging for all API endpoints (messages, webhook, config, ping)
- Added logging to all DMS callback handlers
- Created service logs API endpoints (GET /api/logs, DELETE /api/logs)
- Added UI panel for real-time service execution log viewing
- Implemented log filtering by service type and level
- Added auto-refresh and clear logs functionality
"@

git commit -m $commitMessage
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to commit changes" -ForegroundColor Red
    exit 1
}
Write-Host "Changes committed successfully" -ForegroundColor Green

# Check for remote
Write-Host "`nChecking for GitHub remote..." -ForegroundColor Cyan
$remote = git remote get-url origin 2>$null

if (-not $remote) {
    Write-Host "No GitHub remote configured" -ForegroundColor Yellow
    Write-Host "`nTo add a GitHub remote, run:" -ForegroundColor Cyan
    Write-Host "  git remote add origin https://github.com/YOUR_USERNAME/client-channel-api-playground.git" -ForegroundColor White
    Write-Host "`nThen to push:" -ForegroundColor Cyan
    Write-Host "  git push -u origin main" -ForegroundColor White
    Write-Host "`nOr use Cursor's Source Control panel to push to GitHub" -ForegroundColor Cyan
} else {
    Write-Host "Remote found: $remote" -ForegroundColor Green
    Write-Host "`nTo push to GitHub, run:" -ForegroundColor Cyan
    Write-Host "  git push -u origin main" -ForegroundColor White
    Write-Host "`nOr use Cursor's Source Control panel (Ctrl+Shift+G)" -ForegroundColor Cyan
}

Write-Host "`n=== Script Complete ===" -ForegroundColor Green

