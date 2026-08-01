Write-Host "`n==> Compiling TypeScript..." -ForegroundColor Cyan
node server/node_modules/typescript/lib/tsc.js -p server/tsconfig.json
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[ERROR] TypeScript compilation failed. Fix errors before deploying." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Compiled successfully." -ForegroundColor Green

Write-Host "`n==> Staging all changes..." -ForegroundColor Cyan
git add -A
$status = git status --porcelain
if (-not $status) {
    Write-Host "[INFO] Nothing to commit. Already up to date." -ForegroundColor Yellow
} else {
    $msg = Read-Host "Commit message (press Enter for default)"
    if (-not $msg) { $msg = "deploy: update server build" }
    git commit -m $msg
    Write-Host "[OK] Committed." -ForegroundColor Green
}

Write-Host "`n==> Pushing to GitHub..." -ForegroundColor Cyan
git push
Write-Host "`n[DONE] Deployed! Render will pick up the changes shortly." -ForegroundColor Green
