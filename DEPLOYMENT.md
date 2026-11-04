# Deployment

## Render test deployment

The root `render.yaml` defines the Angular static site, NestJS API, and PostgreSQL database as one Render Blueprint.

1. Push the repository to GitHub and connect it in Render with **New → Blueprint**.
2. Select the repository root so Render detects `render.yaml`.
3. Set `GROQ_API_KEY` when prompted, or add it later under the API service's environment variables. Without an AI provider key, AI-generated features will not work.
4. Wait for the database, API health check, and static site deploys to finish. Use the URLs shown in Render; the Blueprint defaults to `https://buzines.onrender.com` and `https://buzines-api.onrender.com`.
5. To copy the current local SQLite account and company, follow the transfer steps below after Render creates the database.

This Blueprint intentionally uses Render's free plans for testing. Free web services can spin down while idle, and free PostgreSQL databases expire after 30 days. After expiration, the database is inaccessible; after the grace period Render deletes it. Upgrade the database before that deadline if the data must be retained. Do not use this free configuration for production business data.

### Transfer local SQLite data

The migration utility copies users, companies, company settings, AI settings, and job history into an empty PostgreSQL database. Refresh tokens are deliberately not copied, so users must sign in again. It stops rather than silently skipping populated tables it does not support.

1. Back up `backend/prisma/dev.db` before transferring it:

   ```powershell
   New-Item -ItemType Directory -Force .\backups | Out-Null
   Copy-Item .\backend\prisma\dev.db (Join-Path .\backups ("dev-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".db"))
   ```
2. In Render, copy the PostgreSQL **External Database URL**. Do not commit it or paste it into source files.
3. In PowerShell, from the repository root, set the source and target URLs for this terminal only:

   ```powershell
   $sqliteFile = (Resolve-Path .\backend\prisma\dev.db).Path.Replace('\', '/')
   $env:SOURCE_SQLITE_URL = "file:$sqliteFile"
   $env:DATABASE_URL = "<Render External Database URL>"
   Set-Location backend
   npm run db:check-sqlite-migration
   npm run db:migrate-sqlite-to-postgres
   ```

4. Clear the two environment variables when done:

   ```powershell
   Remove-Item Env:SOURCE_SQLITE_URL
   Remove-Item Env:DATABASE_URL
   ```

The existing local SQLite file is not changed. The target must be empty; the migration refuses to merge into a database that already contains users or companies.

## Local development

For local development, start PostgreSQL from the repository root and then run the backend:

```powershell
docker compose up -d postgres
Set-Location backend
Copy-Item .env.example .env  # only if backend/.env does not already exist
npm ci
npx prisma migrate dev
npm run start:dev
```

In another terminal:

```powershell
Set-Location frontend
npm ci
npm start
```

The API is at `http://localhost:3000`, and the frontend is at `http://localhost:4201`. The SQLite file `backend/prisma/dev.db` is retained only as the source for the optional one-time data transfer. The app now uses PostgreSQL.

Never commit `.env` files, API keys, JWT secrets, PostgreSQL URLs, or database files.
