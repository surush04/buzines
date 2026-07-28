@echo off
echo Free public tunnels via LocalTunnel (temporary URLs each run)
echo Make sure backend :3000 and frontend :4201 are already running.
echo.
start "Buzines API tunnel" cmd /k npx localtunnel --port 3000
timeout /t 3 /nobreak >nul
start "Buzines Web tunnel" cmd /k npx localtunnel --port 4201
echo Open the two new windows and copy the https://....loca.lt URLs.
