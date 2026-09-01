# HubSphere V3 — Phase 3 & 4 Audit Report
**Performance & Database Scalability**
Date: 2025-07-14

---

## Scope

| Area | Items Audited |
|---|---|
| **Database Schema** | Full `prisma/schema.prisma` — 42 models, all `@@index`, `@@unique` directives |
| **API Routes** | 6 key endpoints: leads, contacts, deals, employees, CRM dashboard, CRM analytics |
| **Focus Areas** | Missing FK indexes, composite indexes, pagination, N+1 queries, unbounded queries, redundant DB calls |

---

## Phase 4 — DATABASE AUDIT FINDINGS

### 4.1 Missing Foreign-Key Indexes

These FK fields had **no index at all**, causing sequential scans on JOINs and lookups:

| Model | Missing FK Indexes | Impact |
|---|---|---|
| `Call` | `leadId`, `contactId`, `dealId` | Call history on lead/contact/deal detail pages does full table scan |
| `FieldVisit` | `leadId`, `contactId` | Field visit timeline on lead/contact pages does full table scan |
| `AutomationWorkflow` | `createdBy` | User's created-workflows lookup does full table scan |
| `AutomationExecutionLog` | `actionId` | Execution log lookups by action do full table scan |

### 4.2 Missing Composite Indexes (High-Impact Query Patterns)

All API list endpoints filter by `tenantId` + sort by `createdAt`. The schema only had single-column `@@index([tenantId])`, forcing PostgreSQL to do an **index intersection** or sort in memory.

| Model | Composite Index Added | Query Pattern It Optimizes |
|---|---|---|
| `Lead` | `[tenantId, status]` | `WHERE tenantId=? AND status=?` (leads list with status filter) |
| `Lead` | `[tenantId, createdAt]` | `WHERE tenantId=? ORDER BY createdAt DESC` (default leads list sort) |
| `Deal` | `[tenantId, stage]` | `GROUP BY stage WHERE tenantId=?` (dashboard, analytics, pipeline) |
| `Deal` | `[tenantId, createdAt]` | `WHERE tenantId=? ORDER BY createdAt DESC` (default deals list sort) |
| `Contact` | `[tenantId, createdAt]` | Default contact list sort |
| `Employee` | `[tenantId, createdAt]` | Default employee list sort |
| `Employee` | `[tenantId, employmentStatus]` | `WHERE tenantId=? AND employmentStatus=?` filter |
| `Task` | `[tenantId, status]` | `GROUP BY status WHERE tenantId=?` (dashboard) |
| `FollowUp` | `[tenantId, status, followUpAt]` | Dashboard today/overdue query (3-col composite for range scan) |
| `Activity` | `[tenantId, createdAt]` | Timeline view (entity detail page) |
| `Note` | `[tenantId, createdAt]` | Notes timeline |
| `LeaveRequest` | `[tenantId, employeeId]` | "My leave requests" filter |
| `LeaveRequest` | `[tenantId, status]` | Leave approval queue filter |
| `Expense` | `[tenantId, employeeId]` | Employee expense history |
| `Expense` | `[tenantId, status]` | Expense approval queue filter |
| `PayrollRecord` | `[tenantId, employeeId]` | Employee payroll history |
| `PayrollRecord` | `[tenantId, status]` | Payroll status filter |
| `AttendanceSession` | `[tenantId, date]` | Attendance report date range queries |
| `Conversation` | `[tenantId, lastMessageAt]` | Conversation list ordered by last message |
| `Notification` | `[recipientId, isRead]` | "Unread notifications" count query |
| `Notification` | `[recipientId, createdAt]` | Notification list sorted by time |

### 4.3 What Was Already Good

- All multi-tenant business models already had `@@index([tenantId])` ✅
- All junction tables (`LeadTag`, `ContactTag`, `CompanyTag`) use composite primary keys ✅
- `Membership` has `@@unique([userId, tenantId])` and both individual indexes ✅
- `Role` has `@@unique([code, tenantId])` and `@@index([tenantId])` ✅
- FK fields on Activity, Note, FollowUp (leadId, contactId, companyId, dealId, userId) were already indexed ✅
- AuditLog has indexes on actorId, tenantId, action, createdAt ✅

### 4.4 Indexes Added: Summary

| Category | Count |
|---|---|
| Missing FK indexes | 6 |
| Composite indexes (tenantId + sort/filter) | 20 |
| **Total new indexes** | **26** |

---

## Phase 3 — PERFORMANCE AUDIT FINDINGS

### 3.1 API Routes Audited

| # | Route | Method | Purpose |
|---|---|---|---|
| 1 | `/api/v1/crm/leads` | GET, POST | List/create leads |
| 2 | `/api/v1/crm/dashboard` | GET | CRM dashboard metrics |
| 3 | `/api/v1/hrms/employees` | GET, POST | List/create employees |
| 4 | `/api/v1/analytics/crm` | GET | CRM analytics/aggregations |
| 5 | `/api/v1/crm/contacts` | GET, POST | List/create contacts |
| 6 | `/api/v1/crm/deals` | GET, POST | List/create deals |

### 3.2 Issues Found

#### ISSUE P1 — CRITICAL: Unbounded `findMany` in CRM Dashboard
**File:** `src/app/api/v1/crm/dashboard/route.ts` (original line 62)

**Problem:** The dashboard made two queries against the `deals` table:
1. `db.deal.findMany({ where: { tenantId, archived: false }, select: { stage: true, value: true } })` — fetched **every** non-archived deal as individual rows
2. `db.deal.groupBy({ by: ['stage'], ... _sum: { value: true } })` — did the same aggregation in the DB

Query #1 is fully redundant. For a tenant with 10,000 deals, it would transfer 10,000 rows from PostgreSQL to Node.js, only to iterate them in-memory to compute values that query #2 already provides as aggregated sums.

**Impact:** O(N) memory allocation and network transfer per dashboard load, where N = total deal count for tenant.

**Fix Applied:** Removed the redundant `dealMetrics` findMany. The `dealsByStage` groupBy result is now used for both the `dealsByStage` response and the `deals` metrics computation (openDeals, pipelineValue, wonDealsValue, lostDealsValue). Reduced from 6 parallel DB queries to 5.

#### ISSUE P2 — MEDIUM: Sequential Follow-Up Count Queries in Dashboard
**File:** `src/app/api/v1/crm/dashboard/route.ts` (original lines 68-82)

**Problem:** The two follow-up `count()` queries (today's follow-ups and overdue follow-ups) were chained with `.then()`, making them **sequential** instead of parallel. This added ~1 round-trip latency.

**Fix Applied:** Wrapped both counts in `Promise.all([...]).then(...)` so they execute concurrently within the outer `Promise.all` block.

#### ISSUE P3 — LOW: Unbounded `findMany` for Deal Velocity in Analytics
**File:** `src/app/api/v1/analytics/crm/route.ts` (line 92)

**Problem:** `wonDealsForVelocity` fetches all won deals with `{ select: { createdAt: true, updatedAt: true } }` to compute average days-to-close. This is unbounded — for a tenant with 5,000 won deals, it transfers 10,000 DateTime values.

**Mitigating Factors:** Only 2 small DateTime fields per row, and the computation requires per-row data (can't be done with a simple aggregate). Acceptable for now.

**Recommendation (future):** Consider a `$queryRaw` with `AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)` to push the computation to PostgreSQL.

### 3.3 What Was Already Good

- **Pagination:** All list endpoints use `paginationSchema` with `page`/`limit` (max 100). Parallel `findMany + count` pattern. ✅
- **SELECT Restriction:** All list endpoints use explicit `select` objects, avoiding `SELECT *`. ✅
- **N+1 Prevention:** Nested relations use Prisma `select` with sub-selects (owner, tags, company, department, etc.) which resolve via JOINs in a single query. No N+1 patterns detected. ✅
- **Parallel Queries:** Dashboard and analytics endpoints use `Promise.all` for concurrent DB queries. ✅
- **Search Safety:** Search uses `contains` with `mode: 'insensitive'` (PostgreSQL ILIKE). No raw SQL injection. ✅
- **Sort Whitelisting:** All sortable fields are validated against a whitelist (`validSortFields.includes(sortBy)`). ✅

---

## Fixes Applied

### Schema Changes (`prisma/schema.prisma`)

**26 new `@@index` directives** added across 14 models. No existing fields, relations, or indexes were modified.

### Code Changes (`src/app/api/v1/crm/dashboard/route.ts`)

1. **Removed redundant `dealMetrics` findMany** — eliminated unbounded row fetch
2. **Made follow-up count queries parallel** — reduced 1 round-trip
3. **Reused `dealsByStage` groupBy** for all deal metric computations

### Before/After Comparison

| Metric | Before | After |
|---|---|---|
| DB queries per dashboard load | 7 (6 parallel + 1 sequential) | 5 (all parallel) |
| Max rows transferred (dashboard, 10K deals) | ~10,000 deal rows + 5 aggregate rows | 5 aggregate rows only |
| Follow-up query latency | 2x round-trip (sequential) | 1x round-trip (parallel) |
| Missing FK indexes | 6 FK columns unindexed | 0 |
| Missing composite indexes | 20 high-value patterns unoptimized | 0 |

### Migration Required

After merging, run:
```bash
npx prisma migrate dev --name "phase3-4-add-performance-indexes"
```

This will create a migration that adds 26 new indexes. On a large production database, the `CREATE INDEX CONCURRENTLY` pattern is recommended to avoid locking tables:
```sql
-- Generated migration will use CREATE INDEX which locks the table.
-- For zero-downtime on large tables, consider converting to:
CREATE INDEX CONCURRENTLY idx_leads_tenant_status ON leads (tenant_id, status);
```

---

## Recommendations (Not Implemented)

| # | Recommendation | Priority | Reason |
|---|---|---|---|
| R1 | Add `updatedAt` index on high-traffic models (Lead, Deal, Contact) | Low | Sorting by `updatedAt` is allowed but has no composite index |
| R2 | Push deal-velocity computation to PostgreSQL via `$queryRaw` | Low | Small dataset, acceptable for now |
| R3 | Add cursor-based pagination option for very large datasets | Medium | Offset pagination degrades at high page numbers |
| R4 | Consider read replicas for analytics/dashboard endpoints | Medium | Analytics queries are read-heavy and parallelizable |
| R5 | Add `@@index([tenantId, ownerId])` on Deal for "my deals" view | Low | Covered by existing individual indexes for typical data sizes |
