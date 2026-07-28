@echo off
REM Localtunnel quickstart for Buzines
REM Docs: https://localtunnel.github.io/www/
REM   npm install -g localtunnel
REM   lt --port 3000

cd /d "%~dp0"
echo.
echo === Buzines - expose to internet (Localtunnel) ===
echo.

where lt >nul 2>&1 || (
  echo Installing localtunnel globally...
  call npm install -g localtunnel
)

netstat -ano | findstr ":3000" | findstr "LISTENING" >nul || (
  echo ERROR: Backend not running. Run: cd backend ^& npm run start:dev
  exit /b 1
)

echo Building frontend and starting tunnels (port 4201 will be used for static build)...
node scripts/deploy-tunnels.mjs
