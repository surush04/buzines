# Starts the local NestJS API against the PostgreSQL service in docker-compose.yml.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root 'backend'
$env:DATABASE_URL = 'postgresql://abm:abm_secret@localhost:5432/ai_business_manager?schema=public'
$env:NODE_ENV = 'development'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js is not installed or not on PATH.'
}
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) {
  throw 'npm.cmd was not found. Reopen the terminal after installing Node.js.'
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker Desktop is required for local PostgreSQL. Start Docker Desktop and retry.'
}

Write-Host "Node: $(node -v)"
Push-Location $Root
try {
  & docker compose up -d postgres
  if ($LASTEXITCODE -ne 0) { throw 'Failed to start PostgreSQL with docker compose.' }
} finally {
  Pop-Location
}

Set-Location $Backend
if (-not (Test-Path 'node_modules')) {
  Write-Host 'Installing backend dependencies...'
  & $npm.Source ci
  if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }
}

& $npm.Source exec -- prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL migrations failed.' }

if (-not (Test-Path 'dist\src\main.js')) {
  Write-Host 'Building NestJS...'
  & $npm.Source run build
  if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
}

Write-Host 'Listening on http://127.0.0.1:3000 (REST /api/v1, Socket.IO /events, docs /api/docs)'
& $npm.Source run start:prod
