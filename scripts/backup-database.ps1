# Copies backend/prisma/dev.db to backups/ without overwriting previous copies.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$DbFile = Join-Path $Root 'backend\prisma\dev.db'
$BackupDir = Join-Path $Root 'backups'

if (-not (Test-Path $DbFile)) {
  throw "Database not found: $DbFile"
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dest = Join-Path $BackupDir "dev-$stamp.db"
if (Test-Path $dest) {
  throw "Backup already exists: $dest"
}

Copy-Item -Path $DbFile -Destination $dest
$bytes = (Get-Item $dest).Length
Write-Host "Backup OK: $dest ($bytes bytes)"
