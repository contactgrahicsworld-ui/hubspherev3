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
// GET /api/v1/analytics/telecaller — Telecaller Analytics
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'calls.view', payload.tenantId);

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
      callStatusGroups,
      durationAgg,
      callsPerAgent,
      recordingAvailable,
    ] = await Promise.all([
      // Call status distribution
      db.call.groupBy({
        by: ['callStatus'],
        where: { tenantId, ...dateFilter },
        _count: true,
      }),

      // Average duration (only for calls with duration)
      db.call.aggregate({
        where: { tenantId, duration: { not: null }, ...dateFilter },
        _avg: { duration: true },
        _count: true,
      }),

      // Calls per agent (top 10)
      db.call.groupBy({
        by: ['agentId'],
        where: { tenantId, agentId: { not: null }, ...dateFilter },
        _count: true,
        _sum: { duration: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),

      // Recording availability (calls with recording status READY)
      db.call.count({
        where: { tenantId, recordingStatus: 'READY', ...dateFilter },
      }),
    ]);

    // --- Call status map ---
    const statusMap: Record<string, number> = {};
    for (const cs of callStatusGroups) {
      if (cs.callStatus) statusMap[cs.callStatus] = cs._count;
    }

    const totalCalls = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const answered = (statusMap['CONNECTED'] ?? 0) + (statusMap['ENDED'] ?? 0);
    const missed = (statusMap['MISSED'] ?? 0) + (statusMap['FAILED'] ?? 0);

    // --- Average duration ---
    const avgDuration = durationAgg._avg.duration ?? 0;

    // --- Calls per agent ---
    const agentIds = callsPerAgent
      .map((g) => g.agentId)
      .filter((id): id is string => id !== null);

    const agentNames = agentIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, name: true },
        })
      : [];
    const agentNameMap: Record<string, string | null> = {};
    for (const u of agentNames) {
      agentNameMap[u.id] = u.name;
    }

    const callsPerAgentList = callsPerAgent.map((g) => ({
      userId: g.agentId,
      name: g.agentId ? (agentNameMap[g.agentId] ?? null) : null,
      totalCalls: g._count,
      totalDuration: g._sum.duration ?? 0,
    }));

    // --- Call outcome distribution (reuse callStatusGroups)
    const callOutcomeDistribution = callStatusGroups
      .filter((c) => c.callStatus !== null)
      .map((c) => ({
        callStatus: c.callStatus!,
        count: c._count,
      }));

    return NextResponse.json(
      success({
        totalCalls,
        answered,
        missed,
        avgDuration,
        callsPerAgent: callsPerAgentList,
        callOutcomeDistribution,
        recordingAvailable,
      }),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
