# AI Business Manager — System Architecture

## Overview

AI Business Manager is an enterprise-grade, AI-native business operating platform built as a **modular monolith** following **Clean Architecture**, **SOLID**, and **Domain-Driven Design (DDD)** principles.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                              │
│  Angular 21 SPA  │  REST API (Swagger)  │  WebSocket (Socket.io)        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                         APPLICATION LAYER                                 │
│  Auth │ Company │ Dashboard │ AI Engine │ Notifications │ Scheduler     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                           DOMAIN LAYER                                    │
│  User │ Company │ Employee │ Project │ Task │ DailyPlan │ AI Profile    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                       INFRASTRUCTURE LAYER                                │
│  Prisma/PostgreSQL │ Redis │ BullMQ │ OpenAI │ Telegram │ WhatsApp       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Backend Folder Structure

```
backend/
├── prisma/
│   └── schema.prisma              # Database schema (30+ models)
├── src/
│   ├── main.ts                    # Bootstrap, Swagger, CORS
│   ├── app.module.ts              # Root module
│   ├── config/
│   │   └── configuration.ts       # Environment config
│   ├── common/
│   │   ├── decorators/            # @Roles, @Public, @User
│   │   └── guards/                # JwtAuthGuard, RolesGuard
│   ├── prisma/
│   │   ├── prisma.module.ts       # Global Prisma module
│   │   └── prisma.service.ts
│   ├── modules/                   # Feature modules (bounded contexts)
│   │   ├── auth/                  # JWT auth, 2FA, refresh tokens
│   │   ├── company/               # Company, dept, employee, project CRUD
│   │   └── dashboard/             # Executive & manager dashboards
│   └── infrastructure/            # External integrations
│       ├── ai/                    # AI engine, scheduler, controller
│       ├── notifications/         # Telegram, WhatsApp, Email
│       └── websocket/             # Real-time events gateway
└── test/
```

---

## Frontend Folder Structure

```
frontend/src/app/
├── core/
│   ├── guards/                    # authGuard, guestGuard
│   ├── interceptors/              # JWT auth interceptor
│   └── services/                  # AuthService, ApiService, ThemeService
├── shared/
│   └── components/
│       └── layout/                # Sidebar layout with dark mode
└── features/
    ├── auth/                      # Login, Register
    ├── dashboard/                 # Executive dashboard + charts
    ├── employees/                 # Employee management + AI profiles
    ├── projects/                  # Project creation + AI breakdown
    ├── ai-manager/                # AI control center
    ├── reports/                   # Report generation
    ├── calendar/                  # Calendar view
    └── settings/                  # Company, AI, integrations
```

---

## Bounded Contexts (DDD)

| Context | Responsibility | Key Aggregates |
|---------|---------------|----------------|
| **Identity** | Authentication, authorization, roles | User, RefreshToken |
| **Organization** | Company structure | Company, Department, Settings |
| **Workforce** | Employee lifecycle | Employee, Skill, AiProfile |
| **Delivery** | Project execution | Project, Task, Assignment, Dependency |
| **Planning** | Daily operations | DailyPlan, DailyPlanTask |
| **Communication** | Messaging | Message, Notification |
| **Intelligence** | AI operations | AiRecommendation, PerformanceMetric |
| **Reporting** | Analytics | Report, CalendarEvent |

---

## Security Architecture

- **JWT** access tokens (15min) + refresh tokens (7 days)
- **RBAC** with 6 roles: Super Admin, Company Owner, Manager, Team Lead, Employee, HR
- **Global JWT guard** with `@Public()` opt-out
- **Tenant isolation** via company-scoped queries
- **Input validation** via class-validator DTOs

---

## Scalability Strategy

| Concern | Solution |
|---------|----------|
| API scaling | Stateless NestJS instances behind load balancer |
| Background jobs | BullMQ + Redis for AI tasks, notifications |
| Real-time | Socket.io with Redis adapter (future) |
| Database | PostgreSQL with read replicas (future) |
| AI inference | Queue-based with rate limiting |
| Caching | Redis for session, dashboard metrics |

---

## Deployment Architecture (Production)

```
                    ┌─────────────┐
                    │   CDN/WAF   │
                    └──────┬──────┘
                           │
              ┌────────────▼────────────┐
              │     Load Balancer       │
              └──────┬──────────┬───────┘
                     │          │
            ┌────────▼──┐  ┌───▼────────┐
            │  Angular  │  │  NestJS API │
            │  (Nginx)  │  │  (x N)      │
            └───────────┘  └───┬────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
        ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
        │ PostgreSQL│   │   Redis   │   │  OpenAI   │
        └───────────┘   └───────────┘   └───────────┘
```
