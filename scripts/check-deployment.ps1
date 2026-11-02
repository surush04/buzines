# Local checks only. Does not deploy or call Cloudflare/Vercel accounts.
$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'
$failed = 0

function Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Bad($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; $script:failed++ }
function Info($msg) { Write-Host "[INFO] $msg" }

Write-Host '=== Deployment check ==='

if (Get-Command node -ErrorAction SilentlyContinue) { Ok "Node $(node -v)" } else { Bad 'Node.js missing' }

$schema = Get-Content (Join-Path $Backend 'prisma\schema.prisma') -Raw
if ($schema -match 'provider\s*=\s*"sqlite"') { Ok 'Prisma datasource is sqlite' } else { Bad 'Prisma schema is not sqlite' }

$db = Join-Path $Backend 'prisma\dev.db'
if (Test-Path $db) { Ok "Database file present ($db)" } else { Bad "Database file missing: $db" }

$envFile = Join-Path $Backend '.env'
if (Test-Path $envFile) {
  $envText = Get-Content $envFile -Raw
  if ($envText -match 'GROQ_API_KEY=.+') { Ok 'GROQ_API_KEY is set in backend .env (value not printed)' } else { Info 'GROQ_API_KEY empty or missing' }
  if ($envText -match 'JWT_SECRET=.+') { Ok 'JWT_SECRET is set (value not printed)' } else { Bad 'JWT_SECRET missing' }
  if ($envText -match 'DATABASE_URL=.*dev\.db') { Ok 'DATABASE_URL points at a dev.db file URL' } else { Info 'DATABASE_URL does not mention dev.db — confirm it is the intended file' }
  if ($envText -match 'FRONTEND_URL=https://') { Ok 'FRONTEND_URL uses https (production CORS)' } else { Info 'FRONTEND_URL is not https yet — set it to the Vercel origin before friends connect' }
} else {
  Bad 'backend/.env missing'
}

$devEnv = Get-Content (Join-Path $Frontend 'src\environments\environment.ts') -Raw
if ($devEnv -match '127\.0\.0\.1:3000/api/v1') { Ok 'Dev API URL is http://127.0.0.1:3000/api/v1' } else { Bad 'Dev environment API URL unexpected' }
if ($devEnv -match '127\.0\.0\.1:3000/events') { Ok 'Dev WebSocket URL is local /events' } else { Bad 'Dev WebSocket URL unexpected' }

$prodEnv = Get-Content (Join-Path $Frontend 'src\environments\environment.production.ts') -Raw
if ($prodEnv -match 'localhost|127\.0\.0\.1') { Bad 'Production environment still contains localhost/127.0.0.1' } else { Ok 'Production environment has no localhost hosts' }
if ($prodEnv -match 'REPLACE_WITH_CLOUDFLARE_PUBLIC_HOST') { Info 'Production URLs are placeholders until Vercel API_URL is set and patched at build' }

if (Test-Path (Join-Path $Frontend 'vercel.json')) { Ok 'frontend/vercel.json present' } else { Bad 'frontend/vercel.json missing' }

Push-Location $Backend
npx nest build | Out-Host
if ($LASTEXITCODE -eq 0) { Ok 'Backend production compile (nest build)' } else { Bad 'nest build failed' }
Pop-Location

Push-Location $Frontend
npx ng build --configuration=development | Out-Host
if ($LASTEXITCODE -eq 0) { Ok 'Frontend development build' } else { Bad 'ng build (development) failed' }
Pop-Location

try {
  $h = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/v1/health' -UseBasicParsing -TimeoutSec 4
  if ($h.StatusCode -eq 200) { Ok 'Local health endpoint /api/v1/health' } else { Bad "Health status $($h.StatusCode)" }
} catch {
  Info 'Backend not running — skipped live health check (start-backend.ps1)'
}

Write-Host ''
if ($failed -gt 0) {
  Write-Host "Completed with $failed failure(s)."
  exit 1
}
Write-Host 'All executed checks passed.'
exit 0
