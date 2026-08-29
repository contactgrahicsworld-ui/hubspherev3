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
// GET /api/v1/analytics/crm — CRM Analytics
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'leads.view', payload.tenantId);

    const tenantId = payload.tenantId;

    // Parse optional date range
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (dateFrom) dateFilter.createdAt = { ...dateFilter.createdAt, gte: new Date(dateFrom) };
    if (dateTo) dateFilter.createdAt = { ...dateFilter.createdAt, lte: new Date(dateTo) };

    // Run all queries in parallel
    const [
      leadSourceGroups,
      leadStatusGroups,
      dealStageGroups,
      dealOutcomeCounts,
      wonDealsForVelocity,
      salespersonPerformance,
      followUpCompleted,
      followUpMissed,
    ] = await Promise.all([
      // Lead source performance (count by source)
      db.lead.groupBy({
        by: ['source'],
        where: { tenantId, archived: false, ...dateFilter },
        _count: true,
      }),

      // Lead status distribution
      db.lead.groupBy({
        by: ['status'],
        where: { tenantId, archived: false, ...dateFilter },
        _count: true,
      }),

      // Sales funnel (stage counts and values)
      db.deal.groupBy({
        by: ['stage'],
        where: { tenantId, archived: false, ...dateFilter },
        _count: true,
        _sum: { value: true },
      }),

      // Deal outcome counts (WON, LOST, and all others)
      db.deal.groupBy({
        by: ['stage'],
        where: { tenantId, stage: { in: ['WON', 'LOST'] }, archived: false, ...dateFilter },
        _count: true,
      }),

      // Won deals for velocity calculation (createdAt + updatedAt to compute close time)
      db.deal.findMany({
        where: { tenantId, stage: 'WON', archived: false, ...dateFilter },
        select: { createdAt: true, updatedAt: true },
      }),

      // Salesperson performance (top 10 by deals won)
      db.deal.groupBy({
        by: ['ownerId'],
        where: { tenantId, stage: 'WON', archived: false, ownerId: { not: null }, ...dateFilter },
        _count: true,
        _sum: { value: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),

      // Follow-up completed count
      db.followUp.count({
        where: { tenantId, status: 'COMPLETED', ...dateFilter },
      }),

      // Follow-up missed count
      db.followUp.count({
        where: { tenantId, status: 'MISSED', ...dateFilter },
      }),
    ]);

    // --- Lead source performance ---
    // For each source, also count converted leads separately
    const sourceKeys = leadSourceGroups.map((g) => g.source);
    const convertedBySource = sourceKeys.length > 0
      ? await db.lead.groupBy({
          by: ['source'],
          where: { tenantId, status: 'CONVERTED', archived: false, source: { in: sourceKeys }, ...dateFilter },
          _count: true,
        })
      : [];
    const convertedSourceMap: Record<string, number> = {};
    for (const c of convertedBySource) {
      convertedSourceMap[c.source] = c._count;
    }

    const leadSourcePerformance = leadSourceGroups.map((g) => ({
      source: g.source,
      count: g._count,
      converted: convertedSourceMap[g.source] ?? 0,
    }));

    // --- Lead conversion rates (status distribution) ---
    const leadConversionRates = leadStatusGroups.map((g) => ({
      status: g.status,
      count: g._count,
    }));

    // --- Sales funnel ---
    const salesFunnel = dealStageGroups.map((g) => ({
      stage: g.stage,
      count: g._count,
      value: g._sum.value ?? 0,
    }));

    // --- Win rate / loss rate ---
    const outcomeMap: Record<string, number> = {};
    for (const d of dealOutcomeCounts) {
      outcomeMap[d.stage] = d._count;
    }
    const wonCount = outcomeMap['WON'] ?? 0;
    const lostCount = outcomeMap['LOST'] ?? 0;
    const totalClosed = wonCount + lostCount;
    const winRate = totalClosed > 0 ? wonCount / totalClosed : 0;
    const lossRate = totalClosed > 0 ? lostCount / totalClosed : 0;

    // --- Deal velocity (avg days to close for won deals) ---
    let dealVelocity: number | null = null;
    if (wonDealsForVelocity.length > 0) {
      const totalDays = wonDealsForVelocity.reduce((sum, deal) => {
        const diffMs = deal.updatedAt.getTime() - deal.createdAt.getTime();
        return sum + diffMs / (1000 * 60 * 60 * 24);
      }, 0);
      dealVelocity = Math.round((totalDays / wonDealsForVelocity.length) * 100) / 100;
    }

    // --- Salesperson performance ---
    const ownerIds = salespersonPerformance.map((g) => g.ownerId).filter((id): id is string => id !== null);
    const ownerNames = ownerIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true },
        })
      : [];
    const ownerNameMap: Record<string, string | null> = {};
    for (const u of ownerNames) {
      ownerNameMap[u.id] = u.name;
    }

    const topSalespersons = salespersonPerformance.map((g) => ({
      userId: g.ownerId,
      name: g.ownerId ? (ownerNameMap[g.ownerId] ?? null) : null,
      dealsWon: g._count,
      totalValue: g._sum.value ?? 0,
    }));

    // --- Follow-up performance ---
    const followUpPerformance = {
      completed: followUpCompleted,
      missed: followUpMissed,
    };

    return NextResponse.json(
      success({
        leadSourcePerformance,
        leadConversionRates,
        salesFunnel,
        winRate,
        lossRate,
        dealVelocity,
        topSalespersons,
        followUpPerformance,
      }),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
