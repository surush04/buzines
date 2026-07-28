# AI Business Manager

An AI-powered business operating platform that acts as an intelligent manager — planning work, assigning tasks, communicating with employees, and optimizing productivity.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Angular 21 Frontend                          │
│              (Dashboard, Management, Reports)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API + WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│                     NestJS Backend (API Layer)                     │
├──────────┬──────────┬──────────┬──────────┬──────────┬────────────┤
│   Auth   │ Company  │ Employee │ Project  │   AI     │ Notification│
│  Module  │  Module  │  Module  │  Module  │  Engine  │   Module    │
└──────────┴──────────┴──────────┴──────────┴──────────┴────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│              Infrastructure (Prisma, Redis, BullMQ)               │
├─────────────────┬─────────────────┬───────────────────────────────┤
│   PostgreSQL    │      Redis      │   OpenAI / Telegram / WA     │
└─────────────────┴─────────────────┴───────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 21, TypeScript, TailwindCSS |
| Backend | NestJS, TypeScript, Prisma |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis, BullMQ |
| AI | OpenAI API |
| Real-time | WebSocket (Socket.io) |
| Messaging | Telegram Bot API, WhatsApp Business API |

## Quick Start

### Prerequisites

- Node.js 22+
- Docker Desktop (for PostgreSQL & Redis)

### 1. Start Infrastructure

```bash
docker compose up -d
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run start:dev
```

API runs at `http://localhost:3000`  
Swagger docs at `http://localhost:3000/api/docs`

### 3. Frontend Setup

```bash
cd frontend
npm install
npm start
```

App runs at `http://localhost:4200`

## Project Structure

```
Buzines/
├── backend/                 # NestJS API (Clean Architecture)
│   ├── prisma/              # Database schema & migrations
│   └── src/
│       ├── common/          # Guards, decorators, filters
│       ├── config/          # Configuration
│       ├── infrastructure/  # External services (AI, notifications)
│       └── modules/         # Feature modules (DDD bounded contexts)
├── frontend/                # Angular 21 SPA
│   └── src/app/
│       ├── core/            # Auth, interceptors, services
│       ├── shared/          # Reusable UI components
│       └── features/        # Feature modules
├── docs/                    # Architecture & API documentation
└── docker-compose.yml
```

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Database Schema](./docs/DATABASE.md)
- [API Reference](./docs/API.md)
- [AI Workflow](./docs/AI_WORKFLOW.md)

## License

Proprietary — All rights reserved.
