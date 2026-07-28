# AI Workflow Documentation

## Core Principle

**The owner defines structure and goals. The AI runs operations.**

---

## Workflow 1: Project Creation → Task Assignment

```
Owner creates project
        │
        ▼
AI breaks project into categorized tasks
  (Frontend, Backend, Design, Database, etc.)
        │
        ▼
AI creates subtasks for each category
  (Login, Dashboard, API, etc.)
        │
        ▼
AI assigns tasks to employees
  based on: skills, workload, productivity score
        │
        ▼
Project status → ACTIVE
```

**Trigger:** `POST /api/v1/ai/projects/:id/breakdown`

---

## Workflow 2: Daily Plan Generation

```
Cron job at 07:30 (configurable per company)
        │
        ▼
For each ACTIVE employee:
  ├── Gather pending task assignments
  ├── Consider AI profile (productivity, peak hours)
  ├── Generate personalized daily plan message
  ├── Create DailyPlan + DailyPlanTask records
  └── Send via preferred channel:
        ├── In-app notification
        ├── Telegram message
        ├── WhatsApp message
        └── Email
        │
        ▼
Employee receives:
  "Good morning John. Today's Tasks:
   1. Login Page
   2. API Integration
   Deadline: 12:00 PM
   Please reply: Accepted"
```

**Trigger:** Cron `@Cron('30 7 * * *')` or manual `POST /api/v1/ai/companies/:id/daily-plans`

---

## Workflow 3: Employee Response Processing

```
Employee replies: "Blocked — Backend API isn't ready"
        │
        ▼
AI analyzes response (NLP)
  ├── Identifies: BLOCKED status
  ├── Extracts blocker: "Backend API"
  └── Determines affected domain: BACKEND
        │
        ▼
AI actions:
  ├── Update task status → BLOCKED
  ├── Find backend specialist on team
  ├── Send blocker alert notification
  ├── Log TaskResponse with AI analysis
  └── Optionally adjust deadlines
```

**Supported responses:** Accepted, Started, Completed, Blocked, Need Help, Running Late

---

## Workflow 4: Follow-Up & Progress Checks

```
Every 2 hours (configurable)
        │
        ▼
Find IN_PROGRESS and ACCEPTED assignments
  where assigned > 2 hours ago
        │
        ▼
Send progress check notification:
  "How is [task] progressing? Please update your status."
        │
        ▼
Employee responds → Workflow 3
```

---

## Workflow 5: Delay Detection

```
Daily at midnight
        │
        ▼
Find tasks where deadline < now AND status ≠ COMPLETED
        │
        ▼
Mark as OVERDUE
        │
        ▼
Generate AI recommendations:
  ├── Notify owner and manager
  ├── Suggest recovery actions
  └── Update project health score
```

---

## Workflow 6: Smart Analysis & Recommendations

```
Daily at 06:00
        │
        ▼
Analyze company data:
  ├── Overdue task count
  ├── Blocked task count
  ├── Overloaded employees (>5 active tasks)
  └── At-risk projects (health < 70%)
        │
        ▼
Generate ranked recommendations
  stored in ai_recommendations table
        │
        ▼
Display on executive dashboard
```

---

## Workflow 7: Employee AI Chat

```
Employee sends message via any channel
        │
        ▼
AI receives with full context:
  ├── Employee profile & skills
  ├── AI performance profile
  ├── Active task assignments
  └── Company goals
        │
        ▼
AI responds intelligently:
  ├── "I'm sick" → Acknowledge + notify manager
  ├── "Finished" → Mark complete + congratulate
  ├── "Blocked by backend" → Trigger blocker workflow
  ├── "Need more time" → Ask for estimate + adjust plan
  └── "Need clarification" → Provide context from project
```

---

## AI Autonomy Levels

| Level | Behavior |
|-------|----------|
| **Observer** | Monitor and report only |
| **Advisor** | Suggest plans; human approves (default) |
| **Guided Autonomy** | Act on routine; escalate exceptions |
| **Full Autonomy** | End-to-end management with periodic review |

---

## Communication Channels

| Channel | Use Case | Integration |
|---------|----------|-------------|
| In-App | Dashboard notifications, chat | Built-in |
| Telegram | Daily plans, reminders, chat | Bot API |
| WhatsApp | Daily plans, reminders, chat | Business API |
| Email | Reports, announcements | SMTP |
| SMS | Urgent escalations | Future |

---

## AI Profile Learning Loop

```
Employee completes tasks
        │
        ▼
System records: completion time, on-time rate
        │
        ▼
AI Profile updated:
  ├── avgCompletionTimeMin
  ├── taskCompletionRate
  ├── productivityScore
  └── peakProductivityHours
        │
        ▼
Future assignments use updated profile
  for better matching and planning
```
