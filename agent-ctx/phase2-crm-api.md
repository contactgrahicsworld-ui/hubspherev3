# Phase 2 CRM API — Work Record

## Files Created (15 route files)

### 1. Tasks
- `src/app/api/v1/crm/tasks/route.ts` — GET (list with filters: status, priority, ownerId, dueDate range, entityType, entityId), POST create
- `src/app/api/v1/crm/tasks/[id]/route.ts` — GET, PUT (partial update), DELETE (soft delete via status=CANCELLED)

### 2. Follow-Ups
- `src/app/api/v1/crm/follow-ups/route.ts` — GET (list with filters: status, ownerId, followUpAt range), POST create
- `src/app/api/v1/crm/follow-ups/[id]/route.ts` — GET, PUT (with `complete: true` logic setting completedAt + status=COMPLETED), DELETE (soft delete via status=CANCELLED)

### 3. Notes
- `src/app/api/v1/crm/notes/route.ts` — GET (filter by entityType+entityId), POST create
- `src/app/api/v1/crm/notes/[id]/route.ts` — GET, PUT, DELETE (hard delete)

### 4. Tags
- `src/app/api/v1/crm/tags/route.ts` — GET (list tenant tags with usage counts), POST create, DELETE (by query param `id`)

### 5. Timeline
- `src/app/api/v1/crm/timeline/route.ts` — GET combined timeline (Activities + Notes) for LEAD/CONTACT/COMPANY/DEAL, sorted by createdAt desc

### 6. Calls
- `src/app/api/v1/crm/calls/route.ts` — GET (list with filters: direction, callStatus, agentId, recordingStatus, date range), POST create call record
- `src/app/api/v1/crm/calls/[id]/route.ts` — GET single call with recording info

### 7. Dashboard
- `src/app/api/v1/crm/dashboard/route.ts` — GET aggregated metrics: lead counts by status, deal pipeline values, follow-up counts (today/overdue), today's calls, tasks by status, deals by stage

### 8. Global Search
- `src/app/api/v1/crm/search/route.ts` — GET search across leads/contacts/companies/deals, returns top 20 grouped by entity type

### 9. Lead Convert
- `src/app/api/v1/crm/leads/[id]/convert/route.ts` — POST convert lead to contact (creates Contact, auto-creates Company if needed, sets convertedToContactId, creates Activity)

### 10. Import
- `src/app/api/v1/crm/import/route.ts` — POST CSV import (FormData with file + entityType). Supports leads/contacts/companies. Returns { created, skipped, errors }

### 11. Export
- `src/app/api/v1/crm/export/route.ts` — GET CSV export for leads/contacts/companies/deals. Applies current filters. Returns CSV file download.

## Patterns Used
- Auth: `getAuthUser(request)` → JWT verification
- RBAC: `requirePermission(roleCode, permission, tenantId)`
- Responses: `success(data, msg?)`, `paginated(data, total, page, limit)`
- Errors: `NotFoundError`, `ValidationError`, `AuthenticationError`, `ConflictError` from `@/lib/errors`
- Validation: `validate(schema, data)` from `@/lib/validators`
- Audit: `createAuditLog({...})` for all write operations
- DB errors → 503 Service Unavailable
- All records tenant-scoped
- Soft delete via status field (Tasks → CANCELLED, FollowUps → CANCELLED)
- Notes use hard delete (no archived field in schema)

## Lint Status
- ✅ `bun run lint` passes with zero errors
