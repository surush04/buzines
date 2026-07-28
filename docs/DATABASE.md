# Database Schema

PostgreSQL 16 with Prisma ORM. Full schema: `backend/prisma/schema.prisma`

## Entity Relationship Overview

```
User ──owns──▶ Company ──has──▶ Department
                  │                │
                  │                └── employs ──▶ Employee
                  │                                    │
                  ├── has ──▶ Project ──has──▶ Task ──┤
                  │                    │               │
                  │                    └── TaskAssignment
                  │
                  ├── has ──▶ CompanySettings
                  ├── has ──▶ AiSettings
                  ├── has ──▶ Integration (Telegram, WhatsApp)
                  ├── has ──▶ AiRecommendation
                  └── has ──▶ Report

Employee ──has──▶ EmployeeSkill
Employee ──has──▶ EmployeeAiProfile
Employee ──has──▶ DailyPlan ──has──▶ DailyPlanTask
Employee ──has──▶ TaskResponse
Employee ──has──▶ PerformanceMetric
Employee ──has──▶ Notification
Employee ──has──▶ Message
```

## Core Tables (30+ models)

| Table | Purpose |
|-------|---------|
| `users` | Authentication, roles, 2FA |
| `refresh_tokens` | JWT refresh token storage |
| `companies` | Organization root entity |
| `departments` | Organizational units |
| `employees` | Workforce with contact info |
| `employee_skills` | Skill tags for AI assignment |
| `employee_ai_profiles` | AI-learned performance data |
| `projects` | Business projects with deadlines |
| `tasks` | AI-generated or manual tasks |
| `task_dependencies` | Cross-task blocking relationships |
| `task_assignments` | Employee ↔ task mapping |
| `task_responses` | Employee replies with AI analysis |
| `daily_plans` | AI-generated daily schedules |
| `daily_plan_tasks` | Tasks within a daily plan |
| `messages` | Communication log (all channels) |
| `notifications` | Multi-channel notifications |
| `integrations` | Telegram, WhatsApp, Email config |
| `performance_metrics` | Daily productivity snapshots |
| `reports` | Generated reports (daily → yearly) |
| `ai_recommendations` | AI improvement suggestions |
| `calendar_events` | Meetings, deadlines, vacations |
| `company_settings` | Working hours, plan times |
| `ai_settings` | Autonomy level, personality |

## Key Enums

- **UserRole:** SUPER_ADMIN, COMPANY_OWNER, MANAGER, TEAM_LEAD, EMPLOYEE, HR
- **TaskStatus:** PENDING → ASSIGNED → ACCEPTED → IN_PROGRESS → COMPLETED | BLOCKED | OVERDUE
- **TaskResponseType:** ACCEPTED, STARTED, COMPLETED, BLOCKED, NEED_HELP, RUNNING_LATE
- **AiAutonomyLevel:** OBSERVER, ADVISOR, GUIDED_AUTONOMY, FULL_AUTONOMY
- **NotificationChannel:** IN_APP, EMAIL, TELEGRAM, WHATSAPP, SMS

## Migrations

```bash
cd backend
npx prisma migrate dev --name init
npx prisma studio  # Visual database browser
```
