# HubSphere V3 — Production Runbook

> Multi-tenant AI Business Operating System | Next.js 16 + Prisma 6 + PostgreSQL

---

## 1. Quick Start / First Deploy

### Prerequisites

- Node.js 20+ or Bun
- PostgreSQL 16+ (Supabase, RDS, or self-hosted)
- Git

### Local Development

```bash
git clone <repo> && cd my-project
cp .env.example .env    # Configure env vars (see Section 2)
npm install                # or: bun install
npx prisma generate       # Generate Prisma client
npx prisma db push        # Push schema to DB (or prisma migrate dev)
npm run dev               # Starts on http://0.0.0.0:3000
```

### First Deploy Checklist

1. Set all required environment variables (Section 2)
2. Ensure PostgreSQL is running and `DATABASE_URL` is correct
3. Run `npx prisma db push` or `npx prisma migrate deploy` to create tables
4. Deploy the application (Vercel or Docker — Section 8)
5. Open the app URL — you will be redirected to `/setup`
6. Complete the setup wizard to create the first Super Admin (Section 6)
7. Verify `/api/v1/system/health` returns `200`

---

## 2. Environment Variables

### Required (application will not start in production without these)

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Must start with `postgresql://` | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | HMAC-SHA256 secret for access tokens. **Min 32 characters** | `openssl rand -hex 32` |
| `REFRESH_TOKEN_SECRET` | HMAC-SHA256 secret for refresh tokens. **Min 32 characters** | `openssl rand -hex 32` |
| `APP_URL` | Public URL of the application (used for CORS) | `https://app.hubsphere.com` |
| `NODE_ENV` | Runtime environment | `production` |

### Optional — AI Providers

| Variable | Description | Used By |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API key | AI chat, agents |
| `OPENAI_MODEL` | Override default OpenAI model (e.g. `gpt-4o`) | AI Gateway |
| `GOOGLE_AI_API_KEY` | Google AI (Gemini) API key | AI Gateway |
| `ANTHROPIC_API_KEY` | Anthropic (Claude) API key | AI Gateway |
| `DEEPGRAM_API_KEY` | Deepgram STT API key | Speech-to-text |
| `ELEVENLABS_API_KEY` | ElevenLabs API key | Text-to-speech |

### Optional — Telephony / Communication

| Variable | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number for outbound calls |
| `WHATSAPP_PROVIDER_URL` | WhatsApp Business API URL |
| `WHATSAPP_API_TOKEN` | WhatsApp Business API token |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone number ID |

### Optional — Email (SMTP)

| Variable | Description |
|---|---|
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP server port (e.g. `587`) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `EMAIL_FROM` | Sender email address |

### Optional — Storage (AWS S3)

| Variable | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_REGION` | AWS region (e.g. `us-east-1`) |
| `AWS_S3_BUCKET` | S3 bucket name |

### Optional — Infrastructure

| Variable | Description |
|---|---|
| `REDIS_URL` | Redis connection URL (for future caching/sessions) |
| `SENTRY_DSN` | Sentry DSN for error tracking |
| `PUSH_PROVIDER_KEY` | Push notification provider key |

### Validation Rules

- `DATABASE_URL` must start with `postgresql://` or `postgres://`
- `JWT_SECRET` must be **>= 32 characters** (enforced at runtime)
- `REFRESH_TOKEN_SECRET` must be **>= 32 characters** (enforced at runtime)
- In development, missing required vars produce **warnings** (not errors)
- In production, missing required vars **throw and crash** (fail-fast)

---

## 3. Supabase / PostgreSQL Setup

### Supabase (Recommended)

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **Project Settings > Database > Connection string**
3. Use the **URI** format (not the pooler URL for schema migrations)
4. For runtime, use the **Connection Pooler** URL (port 6543) — the app auto-detects this and appends `pgbouncer=true` for PgBouncer compatibility

```
# Direct (for migrations / prisma db push)
postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres

# Pooler (for runtime — set as DATABASE_URL)
postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### Self-Hosted PostgreSQL

```bash
# Docker
docker run -d \
  --name hubsphere-pg \
  -e POSTGRES_USER=hubsphere \
  -e POSTGRES_PASSWORD=<strong_password> \
  -e POSTGRES_DB=hubsphere \
  -p 5432:5432 \
  postgres:16-alpine
```

### Connection Handling

- The app uses a **singleton Prisma client** (hot-reload safe in dev via `globalThis`)
- Prisma logs only `error` level in production, `error` + `warn` in development
- The `isDatabaseConnected()` helper returns `false` gracefully — API routes return 503
- PgBouncer compatibility: auto-detected via port 6543 in `DATABASE_URL`

---

## 4. Database Setup & Migrations

### Schema Overview

The Prisma schema defines **44 models** across these domains:

| Domain | Models |
|---|---|
| **Platform** | Tenant, User, Membership, Role, Permission, RolePermission, Subscription, FeatureFlag, TenantFeatureFlag, AuditLog |
| **Auth** | RefreshToken, PasswordResetToken, EmailVerificationToken |
| **AI** | ProviderConfig, AiUsageLog |
| **CRM** | Lead, Contact, Company, Deal, StageHistory, Call, CallRecording, Tag, LeadTag, ContactTag, CompanyTag, Activity, Note, Task, FollowUp |
| **HRMS** | Department, Designation, Employee, EmployeeDocument, LeaveType, LeaveRequest, AttendanceSession, FieldVisit, Expense, PayrollRecord, PayrollItem, BankTransfer |
| **Communication** | CommunicationProviderConfig, Conversation, Message, MessageAttachment, CommunicationTemplate, DeliveryAttempt, MessageEvent, Notification |
| **Automation** | AutomationWorkflow, AutomationTrigger, AutomationCondition, AutomationAction, AutomationExecution, AutomationExecutionLog |

### Initial Schema Push

```bash
# Development (creates migration + applies)
npx prisma migrate dev --name init

# Production (applies existing migrations)
npx prisma migrate deploy

# Quick push without migration files (acceptable for fresh DB)
npx prisma db push
```

### Generating the Client

```bash
npx prisma generate   # Always run after schema changes
```

### Table Naming

All tables use `snake_case` mapping (e.g. `User` model → `users` table) via `@@map()`.
Columns also use `snake_case` via `@map()`.

---

## 5. Seed Process

### What Gets Seeded

The seed function (`src/lib/seed.ts`) is **idempotent** (safe to run multiple times):

1. **Permissions**: Creates `module.action` entries for all 32 permission modules x 7 actions = **224 permissions**
2. **System Roles**: Creates 12 default roles with permission assignments
3. Uses **bulk operations** (`createMany`) for performance

### Permission Modules

`users`, `roles`, `tenants`, `audit`, `leads`, `contacts`, `companies`, `deals`, `calls`, `recordings`, `tasks`, `followups`, `employees`, `departments`, `designations`, `attendance`, `leave`, `field`, `visits`, `expenses`, `payroll`, `conversations`, `messages`, `templates`, `communication_settings`, `notifications`, `automation`, `webhooks`, `ai`, `subscriptions`, `features`, `settings`

### Permission Actions

`view`, `create`, `edit`, `delete`, `manage`, `export`, `import`

### System Roles

| Role Code | Description |
|---|---|
| `SUPER_ADMIN` | Full access to everything (all 224 permissions) |
| `TENANT_OWNER` | Full tenant access (excludes tenant management) |
| `ADMIN` | Broad access (excludes tenant/delete, features) |
| `MANAGER` | Users, roles, CRM, audit (no delete) |
| `SALES_MANAGER` | Leads, contacts, companies, deals, calls |
| `SALES_EXECUTIVE` | Leads, contacts, deals, calls (no delete) |
| `TELECALLER` | Calls, contacts (no delete) |
| `HR_MANAGER` | Employees, departments, designations, attendance, leave, payroll, expenses |
| `HR_EXECUTIVE` | Same as HR Manager (no delete) |
| `FIELD_MANAGER` | Leads, contacts, field, visits, expenses, attendance (no delete) |
| `FIELD_EXECUTIVE` | Leads, contacts, visits, expenses, attendance (no delete, no approve) |
| `ACCOUNTANT` | Payroll, subscriptions, users.view |
| `VIEWER` | Read-only across all modules |

### Running the Seed

The seed runs **automatically** during first-time setup (`POST /api/v1/auth/setup`). You can also trigger it via:

```bash
# API endpoint (requires auth)
POST /api/v1/system/seed
```

---

## 6. First Super Admin Setup

HubSphere has a **self-service setup flow**:

1. On a fresh deployment, the app detects no users exist and redirects to `/setup`
2. Navigate to `/setup` or call `GET /api/v1/auth/setup/status` to check setup state
3. Call `POST /api/v1/auth/setup` with:

```json
{
  "name": "Admin Name",
  "email": "admin@company.com",
  "password": "SecurePass1",
  "confirmPassword": "SecurePass1"
}
```

This single request:
- Runs the full seed (permissions + roles)
- Creates the Super Admin user (`isSuperAdmin: true`, `emailVerified: true`)
- Creates the default tenant (`HubSphere Enterprise`, plan: `ENTERPRISE`)
- Creates a `TENANT_OWNER` membership
- Issues access + refresh tokens (returned in response and cookies)
- Logs an `auth.setup` audit event

**Password requirements**: Min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit.

After setup, `/setup` returns `403 SETUP_DONE` and is permanently disabled.

---

## 7. Tenant Onboarding

### Creating a Tenant (Super Admin only)

```bash
POST /api/v1/super-admin/tenants
Authorization: Bearer <super_admin_token>

{
  "name": "Acme Corp",
  "slug": "acme-corp",
  "domain": "acme.hubsphere.com"  // optional
}
```

### Inviting Users to a Tenant

```bash
POST /api/v1/admin/users
Authorization: Bearer <token>

{
  "email": "user@acme.com",
  "name": "John Doe",
  "password": "SecurePass1",  // optional — if omitted, user must set via invite
  "roleCode": "SALES_EXECUTIVE"
}
```

### Assignable Roles

Non-super-admin users can be assigned: `ADMIN`, `MANAGER`, `SALES_MANAGER`, `SALES_EXECUTIVE`, `TELECALLER`, `HR_MANAGER`, `HR_EXECUTIVE`, `FIELD_MANAGER`, `FIELD_EXECUTIVE`, `ACCOUNTANT`, `VIEWER`.

### Tenant Plans

| Plan | Default Max Users |
|---|---|
| `FREE` | 5 |
| `STARTER` | 5 |
| `PRO` | 5 |
| `ENTERPRISE` | 1000 |

### Switching Tenant Context

Users with multiple memberships can switch tenants. The JWT `tenantId` claim determines the active tenant for all tenant-scoped operations.

---

## 8. Deployment

### Vercel (Recommended)

1. Connect your Git repository to Vercel
2. Set environment variables in **Vercel Project Settings > Environment Variables**
3. The `vercel.json` is pre-configured: `{ "framework": "nextjs", "buildCommand": "npx next build" }`
4. Vercel handles builds automatically on push
5. **Important**: Set `DATABASE_URL` to the Supabase **pooler** URL (port 6543)

### Docker

```bash
# Build and run with docker-compose (includes PostgreSQL)
docker compose up -d

# Custom database password
DB_PASSWORD=your_secure_password JWT_SECRET=$(openssl rand -hex 32) REFRESH_TOKEN_SECRET=$(openssl rand -hex 32) docker compose up -d
```

### Dockerfile Details

- **Base**: `node:20-alpine` (multi-stage build)
- **Build stage**: Installs deps, generates Prisma client, runs `next build`
- **Runtime stage**: Copies standalone output, runs as non-root `nextjs` user
- Exposes port 3000
- Uses `output: 'standalone'` (configured in build script)

### Manual Docker Build

```bash
docker build -t hubsphere .
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=... \
  -e REFRESH_TOKEN_SECRET=... \
  -e APP_URL=https://yourdomain.com \
  -e NODE_ENV=production \
  hubsphere
```

### Post-Deploy Verification

```bash
curl -s https://your-app.com/api/v1/system/health | jq
curl -s https://your-app.com/api/v1/auth/setup/status | jq
```

---

## 9. Backup & Recovery

### Database Backups

**Supabase**: Automatic daily backups included in all plans. Restore via the Supabase dashboard.

**Self-hosted PostgreSQL**:

```bash
# Full backup
pg_dump -Fc -h localhost -U hubsphere hubsphere > backup_$(date +%Y%m%d_%H%M%S).dump

# Restore from backup
pg_restore -h localhost -U hubsphere -d hubsphere --clean --if-exists backup.dump

# SQL format backup
pg_dump -h localhost -U hubsphere hubsphere > backup_$(date +%Y%m%d).sql

# Restore SQL backup
psql -h localhost -U hubsphere -d hubsphere < backup.sql
```

### Docker Volume Backup

```bash
# Backup the pgdata volume
docker run --rm -v hubsphere_pgdata:/data -v $(pwd):/backup alpine \
  tar czf /backup/pgdata_backup_$(date +%Y%m%d).tar.gz /data

# Restore
docker run --rm -v hubsphere_pgdata:/data -v $(pwd):/backup alpine \
  tar xzf /backup/pgdata_backup_YYYYMMDD.tar.gz -C /
```

### Critical Tables to Back Up

Priority order: `users`, `memberships`, `roles`, `permissions`, `role_permissions`, `tenants`, `refresh_tokens`, `audit_logs`.

### Disaster Recovery

1. Restore PostgreSQL from backup
2. Redeploy application (Vercel redeploy or `docker compose up --build`)
3. Verify health endpoint: `GET /api/v1/system/health`
4. Re-seed if permissions are missing: `POST /api/v1/system/seed`

---

## 10. Troubleshooting

### `Missing required environment variables`

**Symptom**: App crashes on startup in production.
**Fix**: Ensure `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, and `APP_URL` are set. In dev, these produce warnings.

### `JWT_SECRET must be at least 32 characters`

**Symptom**: Startup crash with validation error.
**Fix**: Generate a stronger secret: `openssl rand -hex 32` (produces 64-char hex string).

### `DATABASE_URL should be PostgreSQL`

**Symptom**: Warning/error about non-PostgreSQL URL.
**Fix**: Ensure `DATABASE_URL` starts with `postgresql://`.

### `Database is not available` (503)

**Symptom**: All API routes return 503.
**Fix**:
- Verify PostgreSQL is running: `pg_isready -h host -p 5432`
- Check `DATABASE_URL` is correct
- If using Supabase pooler (port 6543), ensure `pgbouncer=true` is appended (auto-handled by the app)

### `SETUP_DONE` when trying to access `/setup`

**Symptom**: Setup returns 403.
**Fix**: This is expected — a Super Admin already exists. Log in with the existing admin credentials.

### `Token expired` / frequent logouts

**Symptom**: User gets logged out repeatedly.
**Fix**: Access tokens expire after 15 minutes. The frontend should automatically call `POST /api/v1/auth/refresh` using the refresh token cookie. Check that cookies are not being blocked (SameSite=Lax, HttpOnly, Secure in production).

### `Permission denied` errors

**Symptom**: 403 responses for valid operations.
**Fix**: Check the user's role in their membership (`memberships` table). The RBAC system checks exact permission codes against role assignments. View assigned permissions via `GET /api/v1/admin/roles`.

### `Rate limit exceeded` (429)

**Symptom**: 429 Too Many Requests.
**Fix**: Rate limits are per-IP (hashed, privacy-safe). Login: 10/15min, Refresh: 30/15min. Wait for the window to expire.

### `CORS` errors in browser

**Symptom**: Browser blocks API requests.
**Fix**: In production, `Access-Control-Allow-Origin` is set to `APP_URL` (exact match). Ensure `APP_URL` matches the actual domain the browser is using (no trailing slash).

### Prisma migration conflicts

**Symptom**: `prisma migrate dev` fails.
**Fix**: For fresh databases, use `prisma db push`. For existing databases with migrations, use `prisma migrate deploy` (applies without creating new ones).

---

## 11. Architecture Overview

### System Design

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                  │
│              Next.js 16 + React 19 + Tailwind 4     │
└──────────────┬──────────────────────────────────────┘
               │ HTTPS + Cookies / Bearer Token
┌──────────────▼──────────────────────────────────────┐
│               PROXY (src/proxy.ts)                   │
│  • Security headers (CSP, HSTS, X-Frame-Options)    │
│  • CORS (exact origin match in production)          │
│  • CORS preflight (OPTIONS) handling                 │
│  • Page auth redirect (no cookie → /login)           │
│  • Public path passthrough                          │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│              API ROUTES (/api/v1/*)                  │
│  • 96 route handlers across 10 modules               │
│  • Auth: JWT extraction → RBAC check → handler       │
│  • Zod v4 input validation                          │
│  • Centralized error handling (handleApiError)       │
│  • Structured audit logging                         │
│  • DB-backed rate limiting                           │
└──┬─────┬─────┬─────┬─────┬─────┬─────┬─────────────┘
   │     │     │     │     │     │     │
   ▼     ▼     ▼     ▼     ▼     ▼     ▼
 AUTH  CRM  HRMS ADMIN  AI  COMM  AUTO  SUPER
```

### Multi-Tenant Architecture

- **Shared database, shared schema** — all tenants use the same tables
- **Tenant isolation**: Every tenant-scoped query includes `WHERE tenantId = ?`
- **Membership model**: Users join tenants via `Membership` (userId + tenantId + roleCode)
- **JWT claim**: `tenantId` in the access token determines the active tenant context
- **Plan enforcement**: `Tenant.maxUsers` controls user limits per plan

### RBAC Model

- **Permission format**: `module.action` (e.g. `leads.create`, `deals.delete`)
- **Wildcard support**: `leads.*` grants all lead permissions
- **Role hierarchy**: SUPER_ADMIN > TENANT_OWNER > ADMIN > role-specific > VIEWER
- **System roles** (`tenantId: null`): Shared across all tenants
- **Custom roles**: Tenant-specific, stored with `tenantId`
- **Super Admin bypass**: Always has all permissions regardless of role assignments

### Security Layers

1. **CSP**: Strict Content-Security-Policy with frame-ancestors 'none', no inline scripts (except Next.js styled-jsx)
2. **HSTS**: `max-age=31536000; includeSubDomains`
3. **X-Frame-Options**: `DENY`
4. **CORS**: Exact origin match in production, wildcard in dev
5. **CSRF**: Constant-time token comparison available
6. **JWT**: HS256, 15-min access / 30-day refresh, Web Crypto API
7. **Password**: PBKDF2-SHA256, 100,000 iterations, 256-bit output
8. **2FA**: TOTP (RFC 6238) with recovery codes for privileged accounts
9. **Rate limiting**: Database-backed (SHA-256 hashed keys), in-memory fallback
10. **Audit logging**: All significant actions logged with IP/user-agent, sensitive fields stripped
11. **Error sanitization**: Production errors never expose secrets, stack traces, or internal paths
12. **No `X-Powered-By` header** (`poweredByHeader: false` in Next.js config)

### Application Modules

| Module | Route Prefix | Key Features |
|---|---|---|
| **Auth** | `/api/v1/auth/*` | Login, signup, setup, 2FA, password management, token refresh |
| **CRM** | `/api/v1/crm/*` | Leads, contacts, companies, deals, calls, tasks, follow-ups, notes, tags, timeline, search, import, export |
| **HRMS** | `/api/v1/hrms/*` | Employees, departments, designations, attendance, leave, payroll, field visits, expenses |
| **Admin** | `/api/v1/admin/*` | Tenant user management, roles, memberships, settings, audit log |
| **Super Admin** | `/api/v1/super-admin/*` | Cross-tenant management, platform audit, stats |
| **AI** | `/api/v1/ai/*` | Chat, agent system, usage tracking, provider management |
| **Communication** | `/api/v1/communication/*` | Conversations, messages, templates, providers, notifications, webhooks, bulk send |
| **Automation** | `/api/v1/automation/*` | Workflows, triggers, conditions, actions, executions, event dispatch |
| **Analytics** | `/api/v1/analytics/*` | CRM, HR, communication, automation, AI usage, telecaller, executive dashboards |
| **System** | `/api/v1/system/*` | Health check, seed, provider status |