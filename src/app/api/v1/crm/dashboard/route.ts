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
// GET /api/v1/crm/dashboard — Dashboard metrics
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'dashboard.view', payload.tenantId);

    const tenantId = payload.tenantId;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Run all queries in parallel
    const [
      leadCounts,
      dealMetrics,
      followUpMetrics,
      todayCallsCount,
      tasksByStatus,
      dealsByStage,
    ] = await Promise.all([
      // Lead counts by status
      db.lead.groupBy({
        by: ['status'],
        where: { tenantId, archived: false },
        _count: true,
      }),

      // Deal value metrics
      db.deal.findMany({
        where: { tenantId, archived: false },
        select: { stage: true, value: true },
      }),

      // Follow-up metrics
      db.followUp.count({
        where: {
          tenantId,
          status: 'PENDING',
          followUpAt: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) },
        },
      }).then((today) =>
        db.followUp.count({
          where: {
            tenantId,
            status: 'PENDING',
            followUpAt: { lt: todayStart },
          },
        }).then((overdue) => ({ today, overdue }))
      ),

      // Today's calls
      db.call.count({
        where: {
          tenantId,
          createdAt: { gte: todayStart },
        },
      }),

      // Tasks by status
      db.task.groupBy({
        by: ['status'],
        where: { tenantId, status: { not: 'CANCELLED' } },
        _count: true,
      }),

      // Deals by stage (count and value sum)
      db.deal.groupBy({
        by: ['stage'],
        where: { tenantId, archived: false },
        _count: true,
        _sum: { value: true },
      }),
    ]);

    // Compute lead metrics
    const leadMap: Record<string, number> = {};
    for (const lc of leadCounts) {
      leadMap[lc.status] = lc._count;
    }
    const totalLeads = Object.values(leadMap).reduce((a, b) => a + b, 0);

    // Compute deal metrics
    let openDeals = 0;
    let pipelineValue = 0;
    let wonDealsValue = 0;
    let lostDealsValue = 0;
    const wonLeads = leadMap['CONVERTED'] ?? 0;

    for (const deal of dealMetrics) {
      if (deal.stage === 'WON') {
        wonDealsValue += deal.value;
      } else if (deal.stage === 'LOST') {
        lostDealsValue += deal.value;
      } else {
        openDeals++;
        pipelineValue += deal.value;
      }
    }

    // Format tasks by status
    const taskStatusMap: Record<string, number> = {};
    for (const ts of tasksByStatus) {
      taskStatusMap[ts.status] = ts._count;
    }

    // Format deals by stage
    const stageMap: Array<{ stage: string; count: number; value: number }> = dealsByStage.map(
      (ds) => ({
        stage: ds.stage,
        count: ds._count,
        value: ds._sum.value ?? 0,
      }),
    );

    return NextResponse.json(
      success({
        leads: {
          total: totalLeads,
          new: leadMap['NEW'] ?? 0,
          qualified: leadMap['QUALIFIED'] ?? 0,
          won: wonLeads,
          lost: leadMap['LOST'] ?? 0,
        },
        deals: {
          open: openDeals,
          pipelineValue,
          wonDealsValue,
          lostDealsValue,
        },
        followUps: {
          today: followUpMetrics.today,
          overdue: followUpMetrics.overdue,
        },
        calls: {
          today: todayCallsCount,
        },
        tasksByStatus: taskStatusMap,
        dealsByStage: stageMap,
      }),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
