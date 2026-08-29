import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';

// ============================================
// HELPERS
// ============================================

function isDbError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))
  );
}

function dbUnavailableResponse() {
  return NextResponse.json(
    { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
    { status: 503 },
  );
}

// ============================================
// GET /api/v1/analytics/automation — Automation Analytics
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'automation.view', payload.tenantId);

    const tenantId = payload.tenantId;

    // Parse optional date range
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (dateFrom) dateFilter.createdAt = { ...dateFilter.createdAt, gte: new Date(dateFrom) };
    if (dateTo) dateFilter.createdAt = { ...dateFilter.createdAt, lte: new Date(dateTo) };

    // Run initial queries in parallel
    const [
      activeWorkflows,
      executionStatusGroups,
      triggerTypeGroups,
      actionTypeGroups,
    ] = await Promise.all([
      // Active workflows count
      db.automationWorkflow.count({
        where: { tenantId, status: 'ACTIVE' },
      }),

      // Execution status distribution (COMPLETED, FAILED, RUNNING, CANCELLED)
      db.automationExecution.groupBy({
        by: ['status'],
        where: { tenantId, ...dateFilter },
        _count: true,
      }),

      // Top triggers by frequency
      db.automationTrigger.groupBy({
        by: ['eventType'],
        where: { tenantId },
        _count: true,
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),

      // Top actions by frequency
      db.automationAction.groupBy({
        by: ['type'],
        where: { tenantId },
        _count: true,
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    // --- Execution status counts ---
    const execStatusMap: Record<string, number> = {};
    for (const es of executionStatusGroups) {
      execStatusMap[es.status] = es._count;
    }

    const totalExecutions = Object.values(execStatusMap).reduce((a, b) => a + b, 0);
    const successCount = execStatusMap['COMPLETED'] ?? 0;
    const failCount = execStatusMap['FAILED'] ?? 0;

    // --- Average execution duration ---
    // Compute from completedAt - startedAt for completed executions
    const completedExecutions = await db.automationExecution.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        completedAt: { not: null },
        ...dateFilter,
      },
      select: { startedAt: true, completedAt: true },
    });

    let avgExecutionDuration: number | null = null;
    if (completedExecutions.length > 0) {
      const totalMs = completedExecutions.reduce((sum, ex) => {
        return sum + (ex.completedAt!.getTime() - ex.startedAt.getTime());
      }, 0);
      avgExecutionDuration = Math.round(totalMs / completedExecutions.length);
    }

    // --- Top triggers ---
    const topTriggers = triggerTypeGroups.map((g) => ({
      eventType: g.eventType,
      count: g._count,
    }));

    // --- Top actions ---
    const topActions = actionTypeGroups.map((g) => ({
      actionType: g.type,
      count: g._count,
    }));

    return NextResponse.json(
      success({
        activeWorkflows,
        totalExecutions,
        successCount,
        failCount,
        avgExecutionDuration,
        topTriggers,
        topActions,
      }),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
