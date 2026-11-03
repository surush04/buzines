# Local checks only. Does not deploy to Render or access its services.
$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'
$failed = 0

function Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Bad($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; $script:failed++ }
function Info($msg) { Write-Host "[INFO] $msg" }

Write-Host '=== Render deployment check ==='

if (Get-Command node -ErrorAction SilentlyContinue) { Ok "Node $(node -v)" } else { Bad 'Node.js missing' }

$schema = Get-Content (Join-Path $Backend 'prisma\schema.prisma') -Raw
if ($schema -match 'provider\s*=\s*"postgresql"') { Ok 'Prisma datasource is PostgreSQL' } else { Bad 'Prisma schema is not PostgreSQL' }

$migration = Join-Path $Backend 'prisma\migrations\20261103220000_init\migration.sql'
if (Test-Path $migration) { Ok 'PostgreSQL baseline migration present' } else { Bad 'PostgreSQL baseline migration missing' }

$render = Get-Content (Join-Path $Root 'render.yaml') -Raw
if ($render -match 'fromDatabase:' -and $render -match 'name:\s*buzines-db') { Ok 'Render API is connected to its PostgreSQL database' } else { Bad 'Render database connection is missing' }
if ($render -match 'https://buzines-api\.onrender\.com/api/v1') { Ok 'Render frontend API URL configured' } else { Bad 'Render frontend API URL is unexpected' }

$envFile = Join-Path $Backend '.env'
if (Test-Path $envFile) {
  $envText = Get-Content $envFile -Raw
  if ($envText -match 'DATABASE_URL=.*postgres(?:ql)?://') { Ok 'Local DATABASE_URL uses PostgreSQL' } else { Info 'backend/.env does not use PostgreSQL; local startup script sets the compose URL' }
  if ($envText -match 'GROQ_API_KEY\s*=\s*["'']?[^"''\r\n]+') { Ok 'GROQ_API_KEY is set (value not printed)' } else { Info 'GROQ_API_KEY empty; AI features require a provider key' }
} else {
  Info 'backend/.env missing; create it from backend/.env.example for local development'
}

$devEnv = Get-Content (Join-Path $Frontend 'src\environments\environment.ts') -Raw
if ($devEnv -match '127\.0\.0\.1:3000/api/v1') { Ok 'Development API URL is local' } else { Bad 'Development API URL unexpected' }

Push-Location $Backend
& 'npm.cmd' run build | Out-Host
if ($LASTEXITCODE -eq 0) { Ok 'Backend production build' } else { Bad 'Backend build failed' }
Pop-Location

Push-Location $Frontend
& 'npm.cmd' run build | Out-Host
if ($LASTEXITCODE -eq 0) { Ok 'Frontend production build' } else { Bad 'Frontend build failed' }
Pop-Location

try {
  $health = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/v1/health' -UseBasicParsing -TimeoutSec 4
  if ($health.StatusCode -eq 200) { Ok 'Local API health endpoint responds' } else { Bad "Health status $($health.StatusCode)" }
} catch {
  Info 'Local API is not running; skipped live health check'
}

Write-Host ''
if ($failed -gt 0) {
  Write-Host "Completed with $failed failure(s)."
  exit 1
}
Write-Host 'All executed checks passed.'
exit 0
