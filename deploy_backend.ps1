#!/usr/bin/env pwsh
# ============================================================
# DravYantra Backend Deployment Script
# Deploys the local backend to AWS EC2 via SCP + SSH
# ============================================================

$EC2_IP        = "16.112.99.7"
$EC2_USER      = "ubuntu"
$PEM_KEY       = "C:\Users\guruh\Downloads\DravYantra.pem"
$REMOTE_DIR    = "/home/ubuntu/testing"
$LOCAL_BACKEND = "C:\Users\guruh\DravYantra\DY\backend"
$PACKAGE_NAME  = "backend_deploy_$(Get-Date -Format 'yyyyMMdd_HHmmss').zip"
$PACKAGE_PATH  = "C:\Users\guruh\DravYantra\DY\$PACKAGE_NAME"

# ── 1. Verify SSH key exists ──────────────────────────────
if (-not (Test-Path $PEM_KEY)) {
    Write-Error "ERROR: PEM key not found at: $PEM_KEY"
    exit 1
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  DravYantra Backend Deployment to AWS EC2  " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Step 1: Creating deployment package..." -ForegroundColor Yellow

# ── 2. Create a clean zip (exclude unwanted files) ────────
$excludePatterns = @(
    "node_modules",
    ".env",
    "serviceAccountKey.json",
    "scratch",
    "*.log",
    "*.dump",
    "*.zip",
    "*.tar",
    "*.tar.gz",
    # Report output files — not needed on server
    "*.pdf",
    "*.xlsx",
    "*.csv",
    # SQL migration/seed scripts — run manually
    "*.sql",
    # PowerShell scripts — Windows-only, irrelevant on Linux
    "*.ps1",
    "*.sh",
    # Test, debug, check, scratch, seed, simulation one-off scripts
    "test_*",
    "check_*",
    "scratch_*",
    "debug_*",
    "tmp_*",
    "seed_*",
    "simulate_*",
    "prep_*",
    "probe_*",
    "fix_*",
    "drop_*",
    "reset_*",
    "update_*",
    "create_*",
    "migrate_*",
    "promote.js",
    "compare_queries.js",
    "run_live_fleet_simulation.js"
)

$allFiles = Get-ChildItem -Path $LOCAL_BACKEND -Recurse -File | Where-Object {
    $relative = $_.FullName.Substring($LOCAL_BACKEND.Length + 1)
    $excluded = $false
    foreach ($pattern in $excludePatterns) {
        if ($relative -like "*$pattern*") { $excluded = $true; break }
    }
    -not $excluded
}

if (Test-Path $PACKAGE_PATH) { Remove-Item $PACKAGE_PATH -Force }
$allFiles | Compress-Archive -DestinationPath $PACKAGE_PATH -Force

$packageSize = [Math]::Round((Get-Item $PACKAGE_PATH).Length / 1KB, 1)
Write-Host "   Package created: $PACKAGE_NAME ($packageSize KB)" -ForegroundColor Green
Write-Host ""

# ── 3. Upload the zip to EC2 ─────────────────────────────
Write-Host "Step 2: Uploading to EC2 ($EC2_IP)..." -ForegroundColor Yellow

$scpArgs = @(
    "-i", $PEM_KEY,
    "-o", "StrictHostKeyChecking=no",
    "-o", "ConnectTimeout=15",
    $PACKAGE_PATH,
    "${EC2_USER}@${EC2_IP}:/home/ubuntu/$PACKAGE_NAME"
)

$scpProcess = Start-Process -FilePath "scp" -ArgumentList $scpArgs -NoNewWindow -Wait -PassThru
if ($scpProcess.ExitCode -ne 0) {
    Write-Error "SCP upload failed! Check your SSH key and EC2 security group (port 22 open)."
    Remove-Item $PACKAGE_PATH -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "   Upload complete!" -ForegroundColor Green
Write-Host ""

# ── 4. SSH: Backup, extract, install deps, restart PM2 ───
Write-Host "Step 3: Deploying on server..." -ForegroundColor Yellow

# Build the remote shell commands as a single string
$remoteScript = "set -e; " +
    "echo '-- Backing up existing backend...'; " +
    "if [ -d $REMOTE_DIR ]; then cp -r $REMOTE_DIR ${REMOTE_DIR}_bak_`$(date +%Y%m%d_%H%M%S) 2>/dev/null || true; fi; " +
    "echo '-- Extracting new files into $REMOTE_DIR...'; " +
    "mkdir -p $REMOTE_DIR; " +
    "cd /home/ubuntu; " +
    "unzip -o $PACKAGE_NAME -d $REMOTE_DIR; " +
    "echo '-- Installing production dependencies...'; " +
    "cd $REMOTE_DIR; " +
    "npm install --omit=dev --legacy-peer-deps; " +
    "echo '-- Reloading PM2...'; " +
    "if pm2 describe backend > /dev/null 2>&1; then pm2 restart backend --update-env && echo 'PM2 restarted: backend'; " +
    "elif pm2 describe dravyantra > /dev/null 2>&1; then pm2 restart dravyantra --update-env && echo 'PM2 restarted: dravyantra'; " +
    "else pm2 start $REMOTE_DIR/server.js --name backend && echo 'PM2 started new: backend'; fi; " +
    "pm2 save; " +
    "echo '-- Cleaning up zip...'; " +
    "rm /home/ubuntu/$PACKAGE_NAME; " +
    "echo ''; echo 'Deployment complete!'; pm2 list"

$sshArgs = @(
    "-i", $PEM_KEY,
    "-o", "StrictHostKeyChecking=no",
    "-o", "ConnectTimeout=30",
    "${EC2_USER}@${EC2_IP}",
    $remoteScript
)

$sshProcess = Start-Process -FilePath "ssh" -ArgumentList $sshArgs -NoNewWindow -Wait -PassThru
if ($sshProcess.ExitCode -ne 0) {
    Write-Error "Remote deployment failed!"
    Remove-Item $PACKAGE_PATH -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "     Backend Successfully Deployed!          " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Server : http://$EC2_IP" -ForegroundColor Cyan
Write-Host "  Health : http://$EC2_IP/health" -ForegroundColor Cyan
Write-Host ""

# ── 5. Cleanup local zip ──────────────────────────────────
Remove-Item $PACKAGE_PATH -Force -ErrorAction SilentlyContinue
Write-Host "Local package cleaned up." -ForegroundColor DarkGray
Write-Host ""
