# HubSphere V3 — API Architecture

> Technical API documentation for the multi-tenant SaaS platform.
> All routes are under `/api/v1`. Authenticated routes require a valid JWT or cookie.

---

## 1. API Route Structure

All 96 route handlers organized by module. Each route file exports named functions (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) following Next.js 16 App Router conventions.

### 1.1 Authentication (`/api/v1/auth/*`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/v1/auth/setup` | Public | First-time Super Admin setup (runs seed, creates user + tenant) |
| `GET` | `/api/v1/auth/setup/status` | Public | Check if setup has been completed |
| `POST` | `/api/v1/auth/login` | Public | Email + password login (returns 2FA challenge if enabled) |
| `POST` | `/api/v1/auth/signup` | Public | Self-registration (creates user, adds to default tenant) |
| `POST` | `/api/v1/auth/logout` | Auth | Revoke refresh token, clear cookies |
| `POST` | `/api/v1/auth/refresh` | Public | Refresh access token (accepts body or cookie) |
| `GET` | `/api/v1/auth/me` | Auth | Get current user profile + permissions |
| `POST` | `/api/v1/auth/change-password` | Auth | Change current user's password |
| `POST` | `/api/v1/auth/forgot-password` | Public | Request password reset email |
| `POST` | `/api/v1/auth/reset-password` | Public | Reset password using token from email |
| `POST` | `/api/v1/auth/two-factor/setup` | Auth | Start 2FA enrollment (returns QR code URI) |
| `POST` | `/api/v1/auth/two-factor/verify` | Auth | Verify 2FA setup and enable |
| `POST` | `/api/v1/auth/two-factor/challenge` | Public | Verify 2FA code during login |
| `GET` | `/api/v1/auth/two-factor/status` | Auth | Get 2FA enabled status + recovery codes remaining |
| `POST` | `/api/v1/auth/two-factor/disable` | Auth | Disable 2FA for current user |

### 1.2 CRM (`/api/v1/crm/*`)

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET` | `/api/v1/crm/dashboard` | `leads.view` | CRM dashboard stats |
| `GET` | `/api/v1/crm/leads` | `leads.view` | List leads (paginated, filterable, sortable) |
| `POST` | `/api/v1/crm/leads` | `leads.create` | Create a lead |
| `GET` | `/api/v1/crm/leads/[id]` | `leads.view` | Get lead by ID |
| `PUT`/`PATCH` | `/api/v1/crm/leads/[id]` | `leads.edit` | Update lead |
| `DELETE` | `/api/v1/crm/leads/[id]` | `leads.delete` | Delete lead |
| `POST` | `/api/v1/crm/leads/[id]/convert` | `leads.edit` | Convert lead to contact |
| `GET` | `/api/v1/crm/contacts` | `contacts.view` | List contacts |
| `POST` | `/api/v1/crm/contacts` | `contacts.create` | Create contact |
| `GET` | `/api/v1/crm/contacts/[id]` | `contacts.view` | Get contact by ID |
| `PUT`/`PATCH` | `/api/v1/crm/contacts/[id]` | `contacts.edit` | Update contact |
| `DELETE` | `/api/v1/crm/contacts/[id]` | `contacts.delete` | Delete contact |
| `GET` | `/api/v1/crm/companies` | `companies.view` | List companies |
| `POST` | `/api/v1/crm/companies` | `companies.create` | Create company |
| `GET` | `/api/v1/crm/companies/[id]` | `companies.view` | Get company by ID |
| `PUT`/`PATCH` | `/api/v1/crm/companies/[id]` | `companies.edit` | Update company |
| `DELETE` | `/api/v1/crm/companies/[id]` | `companies.delete` | Delete company |
| `GET` | `/api/v1/crm/deals` | `deals.view` | List deals |
| `POST` | `/api/v1/crm/deals` | `deals.create` | Create deal |
| `GET` | `/api/v1/crm/deals/[id]` | `deals.view` | Get deal by ID |
| `PUT`/`PATCH` | `/api/v1/crm/deals/[id]` | `deals.edit` | Update deal |
| `DELETE` | `/api/v1/crm/deals/[id]` | `deals.delete` | Delete deal |
| `POST` | `/api/v1/crm/deals/[id]/stage` | `deals.edit` | Move deal to new pipeline stage |
| `GET` | `/api/v1/crm/calls` | `calls.view` | List calls |
| `POST` | `/api/v1/crm/calls` | `calls.create` | Create call record |
| `POST` | `/api/v1/crm/calls/initiate` | `calls.create` | Initiate an outbound call (telephony provider) |
| `GET` | `/api/v1/crm/calls/[id]` | `calls.view` | Get call by ID |
| `PUT`/`PATCH` | `/api/v1/crm/calls/[id]` | `calls.edit` | Update call record |
| `GET` | `/api/v1/crm/tasks` | `tasks.view` | List tasks |
| `POST` | `/api/v1/crm/tasks` | `tasks.create` | Create task |
| `GET` | `/api/v1/crm/tasks/[id]` | `tasks.view` | Get task by ID |
| `PUT`/`PATCH` | `/api/v1/crm/tasks/[id]` | `tasks.edit` | Update task |
| `DELETE` | `/api/v1/crm/tasks/[id]` | `tasks.delete` | Delete task |
| `GET` | `/api/v1/crm/follow-ups` | `followups.view` | List follow-ups |
| `POST` | `/api/v1/crm/follow-ups` | `followups.create` | Create follow-up |
| `GET` | `/api/v1/crm/follow-ups/[id]` | `followups.view` | Get follow-up by ID |
| `PUT`/`PATCH` | `/api/v1/crm/follow-ups/[id]` | `followups.edit` | Update follow-up |
| `DELETE` | `/api/v1/crm/follow-ups/[id]` | `followups.delete` | Delete follow-up |
| `GET` | `/api/v1/crm/notes` | `leads.view` | List notes |
| `POST` | `/api/v1/crm/notes` | `leads.edit` | Create note |
| `GET` | `/api/v1/crm/notes/[id]` | `leads.view` | Get note by ID |
| `PUT`/`PATCH` | `/api/v1/crm/notes/[id]` | `leads.edit` | Update note |
| `DELETE` | `/api/v1/crm/notes/[id]` | `leads.delete` | Delete note |
| `GET` | `/api/v1/crm/tags` | `leads.view` | List tags |
| `GET` | `/api/v1/crm/timeline` | `leads.view` | Activity timeline |
| `GET` | `/api/v1/crm/search` | `leads.view` | Global CRM search |
| `POST` | `/api/v1/crm/import` | `leads.import` | Import CRM data |
| `GET` | `/api/v1/crm/export` | `leads.export` | Export CRM data |

### 1.3 HRMS (`/api/v1/hrms/*`)

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET` | `/api/v1/hrms/dashboard` | `employees.view` | HRMS dashboard stats |
| `GET` | `/api/v1/hrms/field-dashboard` | `visits.view` | Field operations dashboard |
| `GET` | `/api/v1/hrms/employees` | `employees.view` | List employees |
| `POST` | `/api/v1/hrms/employees` | `employees.create` | Create employee |
| `GET` | `/api/v1/hrms/employees/[id]` | `employees.view` | Get employee by ID |
| `PUT`/`PATCH` | `/api/v1/hrms/employees/[id]` | `employees.edit` | Update employee |
| `DELETE` | `/api/v1/hrms/employees/[id]` | `employees.delete` | Delete employee |
| `GET` | `/api/v1/hrms/departments` | `departments.view` | List departments |
| `POST` | `/api/v1/hrms/departments` | `departments.create` | Create department |
| `GET` | `/api/v1/hrms/departments/[id]` | `departments.view` | Get department by ID |
| `PUT`/`PATCH` | `/api/v1/hrms/departments/[id]` | `departments.edit` | Update department |
| `DELETE` | `/api/v1/hrms/departments/[id]` | `departments.delete` | Delete department |
| `GET` | `/api/v1/hrms/designations` | `designations.view` | List designations |
| `POST` | `/api/v1/hrms/designations` | `designations.create` | Create designation |
| `GET` | `/api/v1/hrms/designations/[id]` | `designations.view` | Get designation by ID |
| `PUT`/`PATCH` | `/api/v1/hrms/designations/[id]` | `designations.edit` | Update designation |
| `DELETE` | `/api/v1/hrms/designations/[id]` | `designations.delete` | Delete designation |
| `GET` | `/api/v1/hrms/attendance` | `attendance.view` | List attendance sessions |
| `POST` | `/api/v1/hrms/attendance` | `attendance.create` | Create attendance record |
| `GET` | `/api/v1/hrms/attendance/[id]` | `attendance.view` | Get attendance by ID |
| `PUT`/`PATCH` | `/api/v1/hrms/attendance/[id]` | `attendance.edit` | Update attendance record |
| `GET` | `/api/v1/hrms/leave-types` | `leave.view` | List leave types |
| `GET` | `/api/v1/hrms/leave-requests` | `leave.view` | List leave requests |
| `POST` | `/api/v1/hrms/leave-requests` | `leave.create` | Create leave request |
| `GET` | `/api/v1/hrms/leave-requests/[id]` | `leave.view` | Get leave request by ID |
| `PUT`/`PATCH` | `/api/v1/hrms/leave-requests/[id]` | `leave.edit` | Update/approve/reject leave request |
| `GET` | `/api/v1/hrms/field-visits` | `visits.view` | List field visits |
| `POST` | `/api/v1/hrms/field-visits` | `visits.create` | Create field visit |
| `GET` | `/api/v1/hrms/field-visits/[id]` | `visits.view` | Get field visit by ID |
| `PUT`/`PATCH` | `/api/v1/hrms/field-visits/[id]` | `visits.edit` | Update field visit |
| `GET` | `/api/v1/hrms/expenses` | `expenses.view` | List expenses |
| `POST` | `/api/v1/hrms/expenses` | `expenses.create` | Create expense |
| `GET` | `/api/v1/hrms/expenses/[id]` | `expenses.view` | Get expense by ID |
| `PUT`/`PATCH` | `/api/v1/hrms/expenses/[id]` | `expenses.edit` | Update/approve/reject expense |
| `GET` | `/api/v1/hrms/payroll` | `payroll.view` | List payroll records |
| `POST` | `/api/v1/hrms/payroll` | `payroll.create` | Create payroll record |
| `GET` | `/api/v1/hrms/payroll/[id]` | `payroll.view` | Get payroll record by ID |
| `PUT`/`PATCH` | `/api/v1/hrms/payroll/[id]` | `payroll.edit` | Update payroll record |

### 1.4 Tenant Admin (`/api/v1/admin/*`)

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET` | `/api/v1/admin/users` | `users.view` | List users in current tenant |
| `POST` | `/api/v1/admin/users` | `users.create` | Create user in current tenant |
| `GET` | `/api/v1/admin/users/[id]` | `users.view` | Get user by ID |
| `PUT`/`PATCH` | `/api/v1/admin/users/[id]` | `users.edit` | Update user |
| `GET` | `/api/v1/admin/roles` | `roles.view` | List roles (system + tenant custom) |
| `POST` | `/api/v1/admin/roles` | `roles.manage` | Create custom role |
| `GET` | `/api/v1/admin/roles/[code]` | `roles.view` | Get role details + permissions |
| `PUT`/`PATCH` | `/api/v1/admin/roles/[code]` | `roles.manage` | Update role permissions |
| `GET` | `/api/v1/admin/memberships` | `users.view` | List tenant memberships |
| `GET` | `/api/v1/admin/audit` | `audit.view` | List tenant audit logs |
| `GET` | `/api/v1/admin/settings` | `settings.view` | Get tenant settings |
| `PUT`/`PATCH` | `/api/v1/admin/settings` | `settings.edit` | Update tenant settings |

### 1.5 Super Admin (`/api/v1/super-admin/*`)

| Method | Route | Requirement | Description |
|--------|-------|-------------|-------------|
| `GET` | `/api/v1/super-admin/stats` | `isSuperAdmin` | Platform-wide statistics |
| `GET` | `/api/v1/super-admin/tenants` | `isSuperAdmin` | List all tenants |
| `POST` | `/api/v1/super-admin/tenants` | `isSuperAdmin` | Create new tenant |
| `GET` | `/api/v1/super-admin/tenants/[id]` | `isSuperAdmin` | Get tenant details |
| `PUT`/`PATCH` | `/api/v1/super-admin/tenants/[id]` | `isSuperAdmin` | Update tenant (name, status, plan) |
| `DELETE` | `/api/v1/super-admin/tenants/[id]` | `isSuperAdmin` | Delete tenant |
| `GET` | `/api/v1/super-admin/users` | `isSuperAdmin` | List all users across tenants |
| `GET` | `/api/v1/super-admin/users/[id]` | `isSuperAdmin` | Get user details |
| `PUT`/`PATCH` | `/api/v1/super-admin/users/[id]` | `isSuperAdmin` | Update any user |
| `GET` | `/api/v1/super-admin/roles` | `isSuperAdmin` | List all roles |
| `GET` | `/api/v1/super-admin/audit` | `isSuperAdmin` | Platform-wide audit log |

### 1.6 AI (`/api/v1/ai/*`)

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `POST` | `/api/v1/ai/chat` | `ai.view` | Send message to AI (routed via AI Gateway) |
| `GET` | `/api/v1/ai/agents` | `ai.view` | List available AI agents |
| `GET` | `/api/v1/ai/usage` | `ai.view` | AI usage statistics |
| `GET` | `/api/v1/ai/providers` | Auth | List configured AI providers + status |

### 1.7 Communication (`/api/v1/communication/*`)

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET` | `/api/v1/communication/dashboard` | `conversations.view` | Communication dashboard stats |
| `GET` | `/api/v1/communication/conversations` | `conversations.view` | List conversations |
| `POST` | `/api/v1/communication/conversations` | `conversations.create` | Create conversation |
| `GET` | `/api/v1/communication/conversations/[id]` | `conversations.view` | Get conversation + messages |
| `PUT`/`PATCH` | `/api/v1/communication/conversations/[id]` | `conversations.edit` | Update conversation |
| `GET` | `/api/v1/communication/conversations/[id]/messages` | `messages.view` | List messages in conversation |
| `POST` | `/api/v1/communication/conversations/[id]/messages` | `messages.create` | Send message |
| `POST` | `/api/v1/communication/conversations/[id]/read` | `messages.edit` | Mark conversation as read |
| `POST` | `/api/v1/communication/send` | `messages.create` | Send direct message (any channel) |
| `POST` | `/api/v1/communication/bulk` | `messages.create` | Bulk send messages |
| `POST` | `/api/v1/communication/cancel` | `messages.edit` | Cancel pending message |
| `GET` | `/api/v1/communication/templates` | `templates.view` | List message templates |
| `POST` | `/api/v1/communication/templates` | `templates.create` | Create template |
| `GET` | `/api/v1/communication/templates/[id]` | `templates.view` | Get template |
| `PUT`/`PATCH` | `/api/v1/communication/templates/[id]` | `templates.edit` | Update template |
| `DELETE` | `/api/v1/communication/templates/[id]` | `templates.delete` | Delete template |
| `GET` | `/api/v1/communication/providers` | `communication_settings.view` | List configured providers |
| `GET` | `/api/v1/communication/providers/[id]` | `communication_settings.view` | Get provider config |
| `PUT`/`PATCH` | `/api/v1/communication/providers/[id]` | `communication_settings.edit` | Update provider config |
| `POST` | `/api/v1/communication/webhook` | Public | Inbound webhook (WhatsApp, Twilio, etc.) |
| `GET` | `/api/v1/communication/notifications` | `notifications.view` | List notifications |
| `GET` | `/api/v1/communication/notifications/[id]` | `notifications.view` | Get notification |
| `PUT`/`PATCH` | `/api/v1/communication/notifications/[id]` | `notifications.edit` | Mark notification read/dismissed |

### 1.8 Automation (`/api/v1/automation/*`)

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET` | `/api/v1/automation/dashboard` | `automation.view` | Automation dashboard stats |
| `GET` | `/api/v1/automation/workflows` | `automation.view` | List workflows |
| `POST` | `/api/v1/automation/workflows` | `automation.create` | Create workflow |
| `GET` | `/api/v1/automation/workflows/[id]` | `automation.view` | Get workflow details |
| `PUT`/`PATCH` | `/api/v1/automation/workflows/[id]` | `automation.edit` | Update workflow |
| `DELETE` | `/api/v1/automation/workflows/[id]` | `automation.delete` | Delete workflow |
| `POST` | `/api/v1/automation/workflows/[id]/activate` | `automation.manage` | Activate workflow |
| `POST` | `/api/v1/automation/workflows/[id]/pause` | `automation.manage` | Pause workflow |
| `GET` | `/api/v1/automation/workflows/[id]/executions` | `automation.view` | List workflow executions |
| `GET` | `/api/v1/automation/executions` | `automation.view` | List all executions |
| `GET` | `/api/v1/automation/executions/[id]` | `automation.view` | Get execution details + logs |
| `POST` | `/api/v1/automation/events` | Auth | Dispatch automation event (trigger evaluation) |

### 1.9 Analytics (`/api/v1/analytics/*`)

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET` | `/api/v1/analytics/crm` | `leads.view` | CRM analytics (lead funnel, deal pipeline) |
| `GET` | `/api/v1/analytics/hr` | `employees.view` | HR analytics (headcount, attendance, leave) |
| `GET` | `/api/v1/analytics/communication` | `conversations.view` | Communication analytics |
| `GET` | `/api/v1/analytics/automation` | `automation.view` | Automation analytics |
| `GET` | `/api/v1/analytics/ai-usage` | `ai.view` | AI usage analytics |
| `GET` | `/api/v1/analytics/telecaller` | `calls.view` | Telecaller performance analytics |
| `GET` | `/api/v1/analytics/executive` | `leads.view` | Executive summary dashboard |
| `POST` | `/api/v1/analytics/report` | Auth | Generate/generate analytics report |

### 1.10 System (`/api/v1/system/*`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/v1/system/health` | Public | Health check (DB connectivity, provider status) |
| `POST` | `/api/v1/system/seed` | Auth | Trigger permission/role seeding (idempotent) |
| `GET` | `/api/v1/system/providers` | Auth | List all registered providers + health status |

---

## 2. Authentication Flow

### 2.1 Token Model

```
┌──────────────────────────────────────────────┐
│              ACCESS TOKEN (JWT)               │
│  Algorithm:  HS256 (Web Crypto HMAC-SHA256)  │
│  Expiry:     15 minutes                      │
│  Transport:  Authorization: Bearer <token>   │
│              OR httpOnly cookie              │
│                                              │
│  Payload:                                   │
│    userId: string                            │
│    email: string                             │
│    isSuperAdmin: boolean                     │
│    tenantId?: string  (active tenant)        │
│    roleCode?: string  (active role)          │
│    iat: number                               │
│    exp: number                               │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│             REFRESH TOKEN                    │
│  Format:     128-char hex (64 random bytes)  │
│  Expiry:     30 days                         │
│  Storage:    Database (refresh_tokens table) │
│  Transport:  httpOnly cookie                 │
│              OR request body JSON             │
└──────────────────────────────────────────────┘
```

### 2.2 Login Flow

```
Client                    Server                     Database
  │                         │                          │
 │─── POST /auth/login ────>│                          │
 │    {email, password}     │                          │
 │                         │─── Find user by email ──>│
 │                         │<── User record ──────────│
 │                         │                          │
 │                         │─── verifyPassword() ─────│ (PBKDF2-SHA256,
 │                         │    (100k iterations)     │  constant-time compare)
 │                         │                          │
 │                    [2FA enabled?]                │
 │                    Yes:                           │
 │<── {twoFactorRequired: true} ─────────────────────│
 │                          │                         │
 │─── POST /auth/two-factor/challenge ─────────────>│
 │    {userId, code}        │                         │
 │                         │─── verifyTOTP() ────────│
 │                         │<── valid ───────────────│
 │                         │                          │
 │                    No / 2FA passed:              │
 │                         │─── generateAccessToken() │
 │                         │─── generateRefreshToken()│
 │                         │─── Store refresh token ──>│
 │                         │─── Update lastLoginAt ──>│
 │                         │─── Create audit log ────>│
 │<── {user, tenant, role, │                          │
 │     accessToken,         │                          │
 │     refreshToken}        │                          │
 │    + Set-Cookie headers  │                          │
```

### 2.3 Token Refresh Flow

```
Client                    Server                     Database
  │                         │                          │
 │─── POST /auth/refresh ──>│                          │
 │    {refreshToken}        │                          │
 │    (or cookie)           │                          │
 │                         │─── Find token ──────────>│
 │                         │<── Token + user ────────│
 │                         │                          │
 │                         │─── Check: not revoked ───│
 │                         │─── Check: not expired ───│
 │                         │─── Check: user not suspended
 │                         │                          │
 │                         │─── Resolve membership ──>│
 │                         │<── roleCode ─────────────│
 │                         │                          │
 │                         │─── generateAccessToken() │
 │                         │─── generateRefreshToken()│
 │                         │                          │
 │                         │─── TRANSACTION:          │
 │                         │    1. Revoke old token ──>│
 │                         │    2. Create new token ──>│
 │                         │                          │
 │<── {accessToken} + cookies                          │
```

Key security properties of refresh:
- **Atomic token rotation**: Old token is revoked and new one created in a single Prisma `$transaction` — no window for replay
- **Revocation detection**: Any attempt to use a revoked token is logged as a security event
- **Tenant re-validation**: Membership is re-checked at refresh time — if user was removed from tenant, they lose access

### 2.4 Two-Factor Authentication (2FA)

- **Algorithm**: TOTP per RFC 6238 (HMAC-SHA1, 30-second period, 6 digits)
- **Implementation**: Pure Web Crypto API, no external dependencies
- **Required for**: `SUPER_ADMIN`, `TENANT_OWNER`, `ADMIN` roles
- **Enrollment**: Returns `otpauth://totp/` URI for QR code scanning
- **Recovery**: 10 single-use recovery codes (SHA-256 hashed for storage)
- **Verification window**: 1 period before/after (±30 seconds)
- **All comparisons**: Constant-time to prevent timing attacks

### 2.5 Token Extraction (Priority Order)

1. `Authorization: Bearer <token>` header
2. `hs-access-token` httpOnly cookie

---

## 3. RBAC System

### 3.1 Permission Model

```
Permission (module.action) ◄─── RolePermission ◄─── Role ◄─── Membership ◄─── User
     │                                                                     │
     │  e.g. "leads.create"                                            tenantId
     │                                                                     │
     └── 224 total permissions                                          Tenant
         (32 modules × 7 actions)
```

### 3.2 Permission Code Format

```
<module>.<action>
```

Examples: `leads.view`, `deals.delete`, `employees.create`, `automation.manage`

Wildcard support: `leads.*` matches any `leads.*` permission.

### 3.3 How `requirePermission()` Works

```typescript
// Called in every authenticated route handler:
await requirePermission(roleCode, 'leads.create', tenantId, isSuperAdmin);
```

Execution flow:

1. **Super Admin / Tenant Owner bypass**: If `roleCode` is `SUPER_ADMIN`, `TENANT_OWNER`, or `isSuperAdmin` is `true`, immediately return `true`
2. **No role**: If `roleCode` is null/undefined, return `false` (throw `AuthorizationError`)
3. **Tenant validation**: If `tenantId` is provided, verify the role exists for this tenant (either as system role with `tenantId: null` or as tenant-specific role)
4. **Exact permission check**: Query `RolePermission` for the exact `module.action` code + `roleCode`
5. **Wildcard check**: If exact not found, check for `module.*` wildcard permission
6. **Deny**: If neither found, throw `AuthorizationError` (HTTP 403)

### 3.4 System Roles vs Custom Roles

| Property | System Role | Custom Role |
|----------|------------|-------------|
| `tenantId` | `null` | Tenant UUID |
| Shared across tenants | Yes | No |
| Created by seed | Yes | By tenant admin |
| Can be deleted | No | Yes |

### 3.5 Role Hierarchy (Implicit)

```
SUPER_ADMIN        → All 224 permissions
TENANT_OWNER       → All except tenant.create/suspend/delete
ADMIN              → Broad access, no tenant mgmt, no audit delete
MANAGER            → Users, roles, CRM, audit (no delete)
SALES_MANAGER      → Leads, contacts, companies, deals, calls
SALES_EXECUTIVE    → Leads, contacts, deals, calls (no delete)
TELECALLER         → Calls, contacts (no delete)
HR_MANAGER         → Employees, departments, designations, attendance, leave, payroll, expenses
HR_EXECUTIVE       → Same as HR Manager (no delete)
FIELD_MANAGER      → Leads, contacts, field, visits, expenses, attendance (no delete)
FIELD_EXECUTIVE    → Leads, contacts, visits, expenses, attendance (no delete, no approve)
ACCOUNTANT         → Payroll, subscriptions, users.view
VIEWER             → All *.view permissions only
```

### 3.6 Getting User Permissions

`getUserPermissions(roleCode, tenantId)` returns an array of permission code strings. For `SUPER_ADMIN`, it returns all 224 permissions. For other roles, it queries the `RolePermission` table.

---

## 4. Multi-Tenant Isolation

### 4.1 Tenant Data Flow

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   JWT Token  │────>│  Route Handler    │────>│  Prisma Query     │
│  tenantId:   │     │  payload.tenantId│     │  WHERE tenantId  │
│   "abc-123"  │     │                  │     │  = "abc-123"      │
└─────────────┘     └──────────────────┘     └──────────────────┘
```

### 4.2 How `tenantId` Flows Through

1. **Login**: First active `Membership` determines `tenantId` in the JWT
2. **Token refresh**: `tenantId` from the stored refresh token is re-validated against current membership
3. **API handler**: `getAuthUser(request)` extracts JWT → `payload.tenantId`
4. **Query**: Every tenant-scoped query uses `where: { tenantId: payload.tenantId }`
5. **Cross-tenant**: Super Admin routes operate without `tenantId` filter (platform-level)

### 4.3 Tenant Context Validation

Most route handlers include this guard:

```typescript
const payload = await getAuthUser(request);
if (!payload.tenantId) {
  throw new AuthenticationError('Tenant context required');
}
await requirePermission(payload.roleCode, 'leads.view', payload.tenantId, payload.isSuperAdmin);
```

### 4.4 Ownership Validation

When creating records with an `ownerId`, the system validates the owner belongs to the same tenant:

```typescript
const ownerExists = await db.membership.findFirst({
  where: { userId: data.ownerId, tenantId: payload.tenantId, status: 'ACTIVE' },
});
if (!ownerExists) throw new ValidationError('Owner not found');
```

### 4.5 Tenant-Scoped Models

All business data models include a `tenantId` foreign key and are queried within tenant scope:

Leads, Contacts, Companies, Deals, Calls, Tasks, FollowUps, Notes, Tags, Activities, Employees, Departments, Designations, LeaveTypes, LeaveRequests, AttendanceSessions, FieldVisits, Expenses, PayrollRecords, Conversations, Messages, CommunicationTemplates, Notifications, AutomationWorkflows, AutomationExecutions, AuditLogs.

### 4.6 Platform-Level Models (No Tenant Scope)

- `User` (global identity)
- `Role` with `tenantId: null` (system roles)
- `Permission` (global)
- `RolePermission` (global)
- `FeatureFlag` (platform defaults)
- `ProviderConfig` (platform-level)

---

## 5. Security Architecture

### 5.1 Content Security Policy (CSP)

Applied by `src/proxy.ts` on every response:

```
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval'
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
img-src 'self' data: blob: https: https://*.supabase.co
font-src 'self' data: https://fonts.gstatic.com
connect-src 'self' https://*.supabase.co https://*.supabase.com https://vitals.vercel-insights.com https://*.vercel.app wss://*.supabase.co
frame-ancestors 'none'
object-src 'none'
base-uri 'self'
form-action 'self'
upgrade-insecure-requests
```

### 5.2 Security Headers

Set on every response by the proxy:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Force HTTPS (1 year) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Block sensor access |
| `X-Permitted-Cross-Domain-Policies` | `none` | Block Flash cross-domain |
| `X-Request-ID` | `<uuid>` (per-request) | Request tracing |
| `Content-Security-Policy` | (see 5.1) | XSS prevention |
| `X-Powered-By` | *(not set)* | Hide server identity |

### 5.3 CORS Configuration

```
Development:  Access-Control-Allow-Origin: *
Production:   Access-Control-Allow-Origin: <exact APP_URL match>

Methods:     GET, POST, PUT, PATCH, DELETE, OPTIONS
Headers:     Content-Type, Authorization
Credentials: true
Max-Age:     86400 (24 hours)
```

Production CORS uses **exact origin matching** — not substring matching — to prevent `evil-app.com` from matching `app.com`.

### 5.4 Rate Limiting

Database-backed distributed rate limiter with in-memory fallback:

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| Login | 10 requests | 15 min | IP + `:login` |
| Token refresh | 30 requests | 15 min | IP + `:refresh` |

Implementation details:
- Keys are **SHA-256 hashed** before storage (privacy)
- Uses `audit_logs` table for distributed counting (fire-and-forget writes)
- Falls back to in-memory `Map` if database is unavailable
- In-memory cleanup runs every 5 minutes
- Returns `Retry-After` header on 429 responses

### 5.5 CSRF Protection

- `verifyCsrfToken()` available in `src/lib/auth.ts`
- Uses **constant-time string comparison**
- SameSite=Lax on all auth cookies prevents most CSRF
- `form-action 'self'` in CSP restricts form submissions

### 5.6 Password Security

- **Algorithm**: PBKDF2-SHA256
- **Iterations**: 100,000 (OWASP minimum)
- **Salt**: 32 random bytes per password
- **Output**: 256-bit derived key
- **Storage format**: `pbkdf2:<iterations>:<saltBase64>:<hashBase64>`
- **Verification**: Constant-time comparison
- **Requirements**: Min 8 chars, 1 uppercase, 1 lowercase, 1 digit

### 5.7 Sensitive Data Protection

Three layers of defense:

1. **Logger** (`src/lib/logger.ts`): Strips 18+ sensitive key patterns and JWT-format values from all logs. Never crashes the app.
2. **Audit log** (`src/lib/audit.ts`): Removes 15 sensitive field names from metadata before storage.
3. **Error handler** (`src/lib/errors.ts`): Sanitizes error messages and details, replacing any string matching 14 sensitive patterns with `[REDACTED]` or `An internal error occurred`.

---

## 6. AI Provider Configuration

### 6.1 Provider Architecture

```
┌───────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  AI Route     │────>│   AI Gateway     │────>│ Provider Registry│
│  /api/v1/ai/* │     │  (singleton)     │     │  (singleton)     │
└───────────────┘     └──────────────────┘     └───────┬──────────┘
                                                       │
                                              ┌────────▼────────┐
                                              │ Highest-priority│
                                              │ configured      │
                                              │ AIProvider      │
                                              └─────────────────┘
```

### 6.2 Provider Categories

| Category | Interface | Env Vars |
|----------|-----------|----------|
| `AIProvider` | `chatCompletion(prompt, context)` | `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`, `ANTHROPIC_API_KEY` |
| `SpeechToTextProvider` | `transcribe(audioBuffer, options)` | `DEEPGRAM_API_KEY` |
| `TextToSpeechProvider` | `synthesize(text, options)` | `ELEVENLABS_API_KEY` |
| `TelephonyProvider` | `initiateCall(to, from)` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |
| `MessagingProvider` | `sendMessage(to, message, channel)` | `WHATSAPP_API_TOKEN` |
| `StorageProvider` | `upload/download/delete/getSignedUrl` | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| `NotificationProvider` | `send(userId, title, body)` | `PUSH_PROVIDER_KEY` |

### 6.3 Provider Selection

The registry selects the **highest-priority configured provider** for a category. If no provider is configured for `AIProvider`, the gateway throws `ProviderNotConfiguredError` (HTTP 503). If a provider is configured but fails health check, it throws `ProviderUnhealthyError` (HTTP 503).

### 6.4 AI Agents

Four built-in agents available via `/api/v1/ai/chat` and `/api/v1/ai/agents`:
- **Nova** — General-purpose assistant
- **SalesPro** — Sales and CRM-focused
- **PeopleMind** — HR and people operations
- **VoxAgent** — Communication and messaging

### 6.5 AI Usage Tracking

All AI interactions are logged to the `AiUsageLog` model. Usage stats are available via `/api/v1/ai/usage` and `/api/v1/analytics/ai-usage`.

---

## 7. Error Handling Patterns

### 7.1 Standard API Response Format

**Success**:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

**Paginated**:
```json
{
  "success": true,
  "data": [...],
  "pagination": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 }
}
```

**Error**:
```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

### 7.2 Error Class Hierarchy

```
AppError (base)
  ├── AuthenticationError     (401)  code: AUTHENTICATION_ERROR
  ├── AuthorizationError      (403)  code: AUTHORIZATION_ERROR
  ├── NotFoundError           (404)  code: NOT_FOUND
  ├── ValidationError         (400)  code: VALIDATION_ERROR
  ├── ConflictError           (409)  code: CONFLICT
  ├── RateLimitError          (429)  code: RATE_LIMIT_EXCEEDED  (+ retryAfter)
  ├── ProviderNotConfiguredError (503)  code: PROVIDER_NOT_CONFIGURED
  └── ProviderUnhealthyError     (503)  code: PROVIDER_UNHEALTHY
```

### 7.3 Centralized Error Handler

Every route wraps its handler in:

```typescript
try {
  // ... handler logic ...
} catch (error) {
  const { statusCode, body } = handleApiError(error);
  return NextResponse.json(body, { status: statusCode });
}
```

`handleApiError()` in `src/lib/errors.ts` handles:

| Error Type | Result |
|-----------|--------|
| `AppError` subclass | Uses its `statusCode`, `code`, `message` |
| Zod `ZodError` | 400 + field-level validation details |
| Prisma `P2002` (unique violation) | 409 + identifies the conflicting field |
| Prisma `P2025` (not found) | 404 |
| Prisma `P2003` (FK violation) | 400 |
| Prisma `P2014` (relation violation) | 400 |
| Prisma `P1001` (connection error) | 503 + "Database not available" |
| Connection errors (ECONNREFUSED, etc.) | 503 |
| Generic `Error` | 500 + sanitized message (dev: full, prod: "Internal server error") |
| Unknown type | 500 + "An unexpected error occurred" |

### 7.4 Production vs Development Error Detail

- **Validation errors**: Field-level details (`{field, message}`) are always included (they contain only field names and messages, not secrets)
- **All other errors**: Details only included in development mode
- **Sensitive data**: Any error message or detail matching 14 regex patterns (password, secret, token, api_key, authorization, cookie, credentials, DATABASE_URL, JWT_SECRET, REDIS_URL, SMTP_PASS, etc.) is replaced with `[REDACTED]` or a generic message

---

## 8. Caching Strategy

### 8.1 Current State

HubSphere V3 does **not** implement an explicit application-level cache layer. The current architecture is:

- **No Redis caching** (REDIS_URL env var exists but is not wired up)
- **No HTTP cache headers** set by the API
- **Prisma query caching**: Not configured (no `@prisma/extension-accelerate` or similar)

### 8.2 Built-in Performance Mechanisms

| Mechanism | Implementation |
|-----------|---------------|
| **Prisma Client Singleton** | Global singleton prevents connection leaks in dev hot-reload |
| **PgBouncer Compatibility** | Auto-detected via port 6543, appends `pgbouncer=true` |
| **Connection Pooling** | Prisma's default connection pool + Supabase PgBouncer for serverless |
| **Select Optimization** | All list queries use explicit `select` to avoid over-fetching |
| **Parallel Queries** | List endpoints use `Promise.all()` for count + data queries |
| **Bulk Operations** | Seed uses `createMany` / `deleteMany` instead of loops |
| **Rate Limit In-Memory Fallback** | Map-based store avoids DB round-trips when DB is down |
| **Next.js Static Assets** | Excluded from proxy matcher (`.css`, `.js`, images, fonts) |
| **Next.js Image Optimization** | Remote patterns enabled for all HTTPS hosts |

### 8.3 Recommended Future Caching Layers

| Layer | Use Case | Suggested Implementation |
|-------|----------|----------------------|
| **Response cache** | Dashboard stats, analytics | Redis or Vercel KV with short TTL (30-60s) |
| **Permission cache** | RBAC checks per request | In-memory LRU with TTL, invalidated on role change |
| **Provider config cache** | AI/communication provider settings | In-memory, loaded once per cold start |
| **CDN/Edge cache** | Public assets, health endpoint | Vercel Edge Network (automatic) |
| **DB query cache** | Frequent read-only queries | PgBouncer prepared statement cache (when not using pooler) |