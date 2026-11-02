# Public access: Vercel frontend + NestJS on this PC + Cloudflare Tunnel

Friends open the **Vercel** site in a browser. The site calls the **API on your Windows computer**, which Cloudflare Tunnel publishes as HTTPS. SQLite stays on this PC (`backend/prisma/dev.db`). Nothing is deployed to Cloudflare or Vercel until **you** log in and click deploy.

This document does not invent a public URL. You will copy the hostname that Cloudflare prints.

## Architecture

```
Friend's browser  →  https://YOUR_VERCEL_APP
                         │  REST + Socket.IO
                         ▼
                  Cloudflare Tunnel (HTTPS / WSS)
                         │
                         ▼
              NestJS on this PC  :3000
              SQLite  backend/prisma/dev.db
              Groq key  only in backend/.env
```

Your PC must stay on, NestJS must stay running, and the tunnel process must stay running. If any of those stop, the public site cannot reach the API.

## 1. Install cloudflared (Windows)

In an elevated or normal PowerShell:

```powershell
winget install --id Cloudflare.cloudflared
```

Close and reopen the terminal, then:

```powershell
cloudflared --version
```

Official builds: [Cloudflare tunnel downloads](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).

## 2. Backend environment (this computer)

`backend/.env` (never commit this file):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Keep `file:./dev.db` so Prisma uses `backend/prisma/dev.db` |
| `PORT` | `3000` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Long random strings in production |
| `GROQ_API_KEY` | Groq key — backend only |
| `FRONTEND_URL` | Exact Vercel origin, e.g. `https://your-app.vercel.app` (no trailing slash) |
| `CORS_ORIGINS` | Optional extra origins, comma-separated (custom domain) |

Copy from `backend/.env.example` if needed. Do not put Groq or JWT values in Angular.

Auth uses **Bearer tokens in localStorage**, not cookies. Cross-origin Vercel → tunnel does not need cookie `SameSite` changes.

## 3. Start NestJS

From the repo root:

```powershell
.\scripts\backup-database.ps1
.\scripts\start-backend.ps1
```

Check locally:

```text
http://127.0.0.1:3000/api/v1/health
http://127.0.0.1:3000/api/docs
```

Leave this window open.

Prisma: relative `file:./dev.db` is resolved to the existing `backend/prisma/dev.db`. Startup **never** runs `migrate reset`, seed, or deletes the file.

If you add schema changes later, use non-destructive `npx prisma db push` or a new migration. Do not use `prisma migrate reset`.

## 4. Cloudflare Tunnel

### A. Quick Tunnel (temporary)

New terminal, repo root:

```powershell
.\scripts\start-backend-tunnel.ps1
```

`cloudflared` prints a URL such as `https://….trycloudflare.com`.

- REST: `https://THAT-HOST/api/v1/health`
- Docs: `https://THAT-HOST/api/docs`
- Socket.IO: client URL `https://THAT-HOST/events` (browser uses **WSS** after upgrade: `wss://THAT-HOST/events`)

**Limitations:** the hostname **changes every restart**. After each change you must update Vercel `API_URL` and **redeploy** Angular. Fine for a test with a friend; not a stable production name.

### B. Named tunnel (stable, needs your domain)

This script will not log in or create a domain. You need a Cloudflare account and a hostname you already control.

```powershell
cloudflared tunnel login
cloudflared tunnel create buzines-api
cloudflared tunnel route dns buzines-api api.YOUR_DOMAIN
```

Point ingress at `http://127.0.0.1:3000`, then:

```powershell
.\scripts\start-backend-tunnel.ps1 -Named -TunnelName buzines-api
```

## 5. Configure Angular production URLs

After you have the public API origin from Cloudflare, set Vercel Environment Variables (Production):

| Name | Value |
|---|---|
| `API_URL` | `https://YOUR_PUBLIC_API_HOST/api/v1` |
| `WS_URL` | `https://YOUR_PUBLIC_API_HOST/events` |

Do not use `localhost` or `127.0.0.1` here.

`frontend/scripts/patch-env.mjs` writes those values into `environment.production.ts` **during the Vercel build**. Development (`ng serve` on port 4201) still uses `http://127.0.0.1:3000`.

## 6. Deploy Angular to Vercel (you click deploy)

1. Push this repo to GitHub (without `.env` and without `*.db`).
2. [vercel.com](https://vercel.com) → Add project → this repo.
3. **Root Directory:** `frontend`
4. Build command / output: already in `frontend/vercel.json`.
5. Add `API_URL` and `WS_URL` (step 5).
6. Deploy.

SPA routing: `vercel.json` rewrites unknown paths to `index.html`.

On the PC, set `FRONTEND_URL` to the Vercel origin (`https://….vercel.app` or your custom domain) and restart NestJS so CORS allows that origin. `*.vercel.app` is also allowed.

## 7. CORS

Allowed:

- `FRONTEND_URL`
- `CORS_ORIGINS` (comma-separated)
- local `localhost` / `127.0.0.1` for development
- `https://*.vercel.app`

Credentials are allowed only for those origins (not `*`). Socket.IO `/events` uses the same origin rules.

## 8. Verify

From any network (or your phone off Wi‑Fi):

1. REST: `https://YOUR_PUBLIC_API_HOST/api/v1/health` → `{ "ok": true, ... }`
2. Open the Vercel site → register / login (JWT in localStorage).
3. WebSocket: after login, browser DevTools → Network → WS to `/events` should be **wss** and status 101 if a client connects. The UI currently talks to the API over REST; Socket.IO is ready on `/events`.
4. Give your friend **only the Vercel URL**, not `localhost` and not the SQLite file.

Local check script (does not deploy):

```powershell
.\scripts\check-deployment.ps1
```

## 9. Backup SQLite

```powershell
.\scripts\backup-database.ps1
```

Copies `backend/prisma/dev.db` to `backups/dev-YYYYMMDD-HHMMSS.db`. Previous backups are never overwritten.

## 10. After you shut down the PC

1. Power on, network up.
2. `.\scripts\start-backend.ps1`
3. `.\scripts\start-backend-tunnel.ps1` (or named tunnel).
4. If you used a **Quick Tunnel**, copy the new URL into Vercel `API_URL` / `WS_URL` and **redeploy** the frontend.
5. Named tunnel: hostname stays the same; no frontend rebuild.

## 11. Common problems

| Symptom | What to try |
|---|---|
| Friend sees the site but login fails | NestJS or tunnel not running; CORS: set `FRONTEND_URL` to the exact Vercel origin; check `API_URL` on the last Vercel deploy |
| CORS error | Restart API after changing `FRONTEND_URL`; no trailing slash; custom domain must be in `FRONTEND_URL` or `CORS_ORIGINS` |
| Quick Tunnel URL changed | Redeploy Vercel with the new `API_URL` |
| Health works, AI does not | `GROQ_API_KEY` in `backend/.env` only |
| Database empty / wrong file | Confirm `backend/prisma/dev.db` and `DATABASE_URL=file:./dev.db`. Never run `prisma migrate reset` |
| Port 3000 in use | Stop the other Nest process, then start-backend again |

## 12. What must stay private

- `backend/.env`
- Groq / JWT secrets
- `backend/prisma/dev.db` (gitignored)
- Cloudflare tunnel credentials (`~/.cloudflared/`)
- Prisma Studio — do not tunnel port 5555
