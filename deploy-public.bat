@echo off
cd /d "%~dp0"
echo Checking local servers...
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul || (
  echo ERROR: Backend not running on port 3000. Start: cd backend ^& npm run start:dev
  exit /b 1
)
netstat -ano | findstr ":4201" | findstr "LISTENING" >nul || (
  echo ERROR: Frontend not running on port 4201. Start: cd frontend ^& npm start
  exit /b 1
)
echo Starting public tunnels...
node scripts/deploy-tunnels.mjs
