# REST API Reference

Base URL: `http://localhost:3000/api/v1`  
Swagger UI: `http://localhost:3000/api/docs`

All protected endpoints require: `Authorization: Bearer <access_token>`

---

## Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate refresh token |
| POST | `/auth/forgot-password` | Request password reset |
| GET | `/auth/me` | Get current user profile |

### Register
```json
POST /auth/register
{
  "email": "owner@company.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "COMPANY_OWNER"
}
```

### Login
```json
POST /auth/login
{
  "email": "owner@company.com",
  "password": "SecurePass123!"
}
```

---

## Companies

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| POST | `/companies` | OWNER | Create company |
| GET | `/companies` | All | List owned companies |
| GET | `/companies/:id` | All | Get company details |
| POST | `/companies/:id/departments` | OWNER, MANAGER | Create department |
| POST | `/companies/:id/employees` | OWNER, MANAGER, HR | Add employee |
| GET | `/companies/:id/employees` | All | List employees |
| GET | `/companies/:id/employees/:employeeId` | All | Employee + AI profile |
| POST | `/companies/:id/projects` | OWNER, MANAGER | Create project |
| GET | `/companies/:id/projects` | All | List projects |
| PUT | `/companies/:id/settings` | OWNER | Update working hours |
| PUT | `/companies/:id/ai-settings` | OWNER | Update AI config |

---

## Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard/companies/:companyId` | Executive dashboard KPIs + charts |
| GET | `/dashboard/companies/:companyId/manager` | Manager dashboard with team details |

---

## AI Engine

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai/projects/:projectId/breakdown` | AI breaks project into tasks & assigns |
| POST | `/ai/companies/:companyId/daily-plans` | Generate daily plans for all employees |
| POST | `/ai/employees/:employeeId/tasks/:taskId/respond` | Employee task response |
| POST | `/ai/employees/:employeeId/chat` | Employee chat with AI manager |
| GET | `/ai/companies/:companyId/recommendations` | Get AI recommendations |

### Task Response
```json
POST /ai/employees/:employeeId/tasks/:taskId/respond
{
  "responseType": "BLOCKED",
  "message": "Backend API isn't ready"
}
```

Response types: `ACCEPTED`, `STARTED`, `COMPLETED`, `BLOCKED`, `NEED_HELP`, `RUNNING_LATE`

### Employee Chat
```json
POST /ai/employees/:employeeId/chat
{
  "message": "I'm blocked by the backend team"
}
```

---

## WebSocket Events

Namespace: `/events`

| Event | Direction | Description |
|-------|-----------|-------------|
| `join:company` | Client → Server | Join company room |
| `join:employee` | Client → Server | Join employee room |
| `dashboard:update` | Server → Client | Real-time KPI updates |
| `notification` | Server → Client | New notification |
| `task:update` | Server → Client | Task status change |

---

## Roles

| Role | Permissions |
|------|-------------|
| SUPER_ADMIN | Full platform access |
| COMPANY_OWNER | Full company access, AI settings |
| MANAGER | Employees, projects, dashboard |
| TEAM_LEAD | Team view, task management |
| EMPLOYEE | Own tasks, AI chat |
| HR | Employee management |
