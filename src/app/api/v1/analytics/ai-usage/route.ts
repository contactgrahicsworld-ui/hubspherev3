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

/**
 * Compute a percentile from a sorted array of numbers.
 */
function percentile(sortedValues: number[], p: number): number | null {
  if (sortedValues.length === 0) return null;
  const idx = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(idx, sortedValues.length - 1))];
}

// ============================================
// GET /api/v1/analytics/ai-usage — AI Usage Analytics
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'ai.view', payload.tenantId, payload.isSuperAdmin);

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
      statusGroups,
      agentGroups,
      modelGroups,
      latencyRecords,
    ] = await Promise.all([
      // Status distribution
      db.aiUsageLog.groupBy({
        by: ['status'],
        where: { tenantId, ...dateFilter },
        _count: true,
      }),

      // By agent breakdown
      db.aiUsageLog.groupBy({
        by: ['agentName'],
        where: { tenantId, ...dateFilter },
        _count: true,
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),

      // By model breakdown
      db.aiUsageLog.groupBy({
        by: ['model'],
        where: { tenantId, ...dateFilter },
        _count: true,
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),

      // Fetch durationMs for latency metrics
      db.aiUsageLog.findMany({
        where: { tenantId, durationMs: { not: null }, ...dateFilter },
        select: { durationMs: true },
      }),
    ]);

    // --- Status counts ---
    const statusMap: Record<string, number> = {};
    for (const sg of statusGroups) {
      statusMap[sg.status] = sg._count;
    }

    const totalRequests = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const successCount = statusMap['SUCCESS'] ?? 0;
    const failCount = totalRequests - successCount;

    // --- By agent ---
    const byAgent = agentGroups.map((g) => ({
      agentName: g.agentName ?? 'unknown',
      count: g._count,
    }));

    // --- By model ---
    const byModel = modelGroups.map((g) => ({
      model: g.model ?? 'unknown',
      count: g._count,
    }));

    // --- Latency metrics ---
    const durations = latencyRecords
      .map((r) => r.durationMs)
      .filter((d): d is number => d !== null)
      .sort((a, b) => a - b);

    const avgLatency = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

    const p50Latency = percentile(durations, 50);
    const p95Latency = percentile(durations, 95);

    return NextResponse.json(
      success({
        totalRequests,
        successCount,
        failCount,
        byAgent,
        byModel,
        latency: {
          avg: avgLatency,
          p50: p50Latency,
          p95: p95Latency,
        },
      }),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
