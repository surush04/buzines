# Starts NestJS in production mode on 0.0.0.0:3000. Does not reset or seed the database.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root 'backend'
$DbFile = Join-Path $Backend 'prisma\dev.db'

Write-Host '=== Buzines backend (production) ==='

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js is not installed or not on PATH.'
}
Write-Host "Node: $(node -v)"

Set-Location $Backend

if (-not (Test-Path 'node_modules')) {
  Write-Host 'Installing backend dependencies...'
  npm install
}

if (-not (Test-Path $DbFile)) {
  throw "Database not found: $DbFile  (refusing to create or migrate automatically)"
}
Write-Host "Database: $DbFile"

$unixDb = ($DbFile -replace '\\', '/')
$env:DATABASE_URL = "file:$unixDb"
if (-not $env:NODE_ENV) { $env:NODE_ENV = 'production' }
if (-not $env:PORT) { $env:PORT = '3000' }

if (-not (Test-Path 'dist\main.js')) {
  Write-Host 'Building NestJS...'
  npx nest build
}

Write-Host 'Listening on 0.0.0.0:3000 (REST /api/v1, Socket.IO /events, docs /api/docs)'
npm run start:prod
