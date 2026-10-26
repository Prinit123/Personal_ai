# backup.ps1 — MyPersonalAI Backup Utility
# Creates a timestamped zip backup of your projects, knowledge, and config.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\backup.ps1

$root       = Split-Path $PSScriptRoot -Parent
$backupsDir = Join-Path $root "backups"
$timestamp  = Get-Date -Format "yyyyMMdd_HHmmss"
$backupName = "backup_$timestamp.zip"
$backupPath = Join-Path $backupsDir $backupName

$dirsToBackup = @(
    (Join-Path $root "projects"),
    (Join-Path $root "knowledge"),
    (Join-Path $root "config"),
    (Join-Path $root ".env.example"),
    (Join-Path $root "README.md")
)

Write-Host ""
Write-Host "Creating backup: $backupName" -ForegroundColor Cyan

# Build the zip
Compress-Archive -Path $dirsToBackup -DestinationPath $backupPath -CompressionLevel Optimal

$sizeMB = [math]::Round((Get-Item $backupPath).Length / 1MB, 2)
Write-Host "Backup saved: $backupPath ($sizeMB MB)" -ForegroundColor Green

# ─── Keep only the 5 most recent backups ─────────────────────────
$allBackups = Get-ChildItem $backupsDir -Filter "backup_*.zip" | Sort-Object LastWriteTime -Descending
if ($allBackups.Count -gt 5) {
    $toDelete = $allBackups | Select-Object -Skip 5
    foreach ($f in $toDelete) {
        Remove-Item $f.FullName -Force
        Write-Host "Removed old backup: $($f.Name)" -ForegroundColor Yellow
    }
}

Write-Host "Done." -ForegroundColor Green
