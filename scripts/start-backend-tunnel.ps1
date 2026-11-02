# Exposes localhost:3000 with Cloudflare Tunnel. Does not log in or create accounts.
param(
  [switch]$Named,
  [string]$TunnelName = '',
  [string]$Hostname = ''
)

$ErrorActionPreference = 'Stop'

Write-Host '=== Cloudflare Tunnel for NestJS :3000 ==='

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  Write-Host @'
cloudflared is not installed.
Install (pick one):
  winget install --id Cloudflare.cloudflared
  or https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
Then reopen PowerShell.
'@
  exit 1
}
Write-Host "cloudflared: $(cloudflared --version 2>&1 | Select-Object -First 1)"

$healthy = $false
try {
  $res = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/v1/health' -UseBasicParsing -TimeoutSec 5
  if ($res.StatusCode -eq 200) { $healthy = $true }
} catch { $healthy = $false }

if (-not $healthy) {
  Write-Host 'NestJS is not reachable at http://127.0.0.1:3000/api/v1/health'
  Write-Host 'Start it first:  .\scripts\start-backend.ps1'
  exit 1
}
Write-Host 'Local API health check: OK'

if ($Named) {
  if (-not $TunnelName) {
    Write-Host @'
Named tunnel needs a Cloudflare account and a domain you already own.

This script will not authenticate. Run once yourself:
  cloudflared tunnel login
  cloudflared tunnel create buzines-api
  cloudflared tunnel route dns buzines-api api.YOUR_DOMAIN

Then:
  .\scripts\start-backend-tunnel.ps1 -Named -TunnelName buzines-api

Ingress must send hostname traffic to http://127.0.0.1:3000
'@
    exit 1
  }
  Write-Host "Starting named tunnel: $TunnelName"
  if ($Hostname) {
    Write-Host "Expected public HTTPS: https://$Hostname"
    Write-Host "REST:  https://$Hostname/api/v1/health"
    Write-Host "WSS:   wss://$Hostname/events"
    Write-Host "Set Vercel API_URL=https://$Hostname/api/v1 then redeploy Angular."
  }
  cloudflared tunnel run $TunnelName
  exit $LASTEXITCODE
}

Write-Host @'
Starting a Quick Tunnel (temporary).
Limitations:
  - HTTPS URL changes every restart.
  - You must update Vercel API_URL and redeploy Angular after each new URL.
  - For a stable hostname, use a named tunnel and your own domain (-Named).

cloudflared will print a line like:
  https://xxxx.trycloudflare.com

Then set Vercel:
  API_URL = https://THAT-HOST/api/v1
  WS_URL  = https://THAT-HOST/events

WSS equivalent: wss://THAT-HOST/events
Set Windows FRONTEND_URL to your Vercel origin and restart NestJS.
Press Ctrl+C to stop the tunnel.
'@

cloudflared tunnel --url http://127.0.0.1:3000 --no-autoupdate
