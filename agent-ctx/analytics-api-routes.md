# Analytics API Routes - Work Record

## Task: Implement Advanced Analytics Layer (6 API routes)

### Completed Files

1. **`/src/app/api/v1/analytics/executive/route.ts`** — Executive Dashboard
   - RBAC: `dashboard.view`
 - KPIs: totalEmployees, totalLeads, totalDeals, totalRevenue (won deals value), activeConversations, openTasks, todaysAttendance
 - Date range filtering via `dateFrom`/`dateTo` query params on leads, deals, conversations, tasks
 - Employees (current count) and today's attendance not date-filtered

2. **`/src/app/api/v1/analytics/crm/route.ts`** — CRM Analytics
   - RBAC: `leads.view`
 - leadSourcePerformance (groupBy source with count + converted count)
 - leadConversionRates (status distribution)
 - salesFunnel (stage counts and values from deals groupBy)
 - winRate, lossRate (computed from WON/LOST counts)
 - dealVelocity (avg days to close for won deals using createdAt→updatedAt)
 - topSalespersons (top 10 by deals won with user names)
 - followUpPerformance (completed vs missed counts)

3. **`/src/app/api/v1/analytics/telecaller/route.ts`** — Telecaller Analytics
   - RBAC: `calls.view`
 - totalCalls, answered (CONNECTED+ENDED), missed (MISSED+FAILED)
 - avgDuration (from aggregate)
 - callsPerAgent (top 10 with user names and total duration)
 - callOutcomeDistribution (by callStatus)
 - recordingAvailable (recordingStatus=READY count)

4. **`/src/app/api/v1/analytics/communication/route.ts`** — Communication Analytics
   - RBAC: `messages.view`
 - sent/delivered/read/failed counts
 - channelDistribution
 - automationGenerated (direction=SYSTEM count)

5. **`/src/app/api/v1/analytics/automation/route.ts`** — Automation Analytics
   - RBAC: `automation.view`
 - activeWorkflows count
 - totalExecutions, successCount, failCount
 - avgExecutionDuration (computed from startedAt→completedAt for completed executions)
 - topTriggers (top 10 event types by count)
 - topActions (top 10 action types by count)

6. **`/src/app/api/v1/analytics/ai-usage/route.ts`** — AI Usage Analytics
   - RBAC: `ai.view`
 - totalRequests, successCount, failCount
 - byAgent breakdown (top 20)
 - byModel breakdown (top 20)
 - latency: avg, p50, p95 (computed from sorted durationMs values)

### Patterns Followed
- Exact match of existing route patterns (imports, error handling, response format)
- `isDbError()` + `dbUnavailableResponse()` for 503 DB error handling
- `getAuthUser()` → tenant check → `requirePermission()` flow
- `success()` wrapper for all responses
- `db.xxx.groupBy()`, `db.xxx.count()`, `db.xxx.aggregate()` for Prisma queries
- All queries tenant-scoped with `where: { tenantId }`
- Date range: `where: { createdAt: { gte/lte } }`
- Returns `null` or `0` for uncomputable metrics (never fabricated)
- No `any` types used
- ESLint passes clean
