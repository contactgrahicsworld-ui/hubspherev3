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
// GET /api/v1/analytics/communication — Communication Analytics
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'messages.view', payload.tenantId, payload.isSuperAdmin);

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
      messageStatusGroups,
      channelGroups,
      automationGeneratedCount,
    ] = await Promise.all([
      // Message status counts
      db.message.groupBy({
        by: ['status'],
        where: { tenantId, ...dateFilter },
        _count: true,
      }),

      // Channel distribution
      db.message.groupBy({
        by: ['channel'],
        where: { tenantId, ...dateFilter },
        _count: true,
      }),

      // Automation-generated communication (direction = SYSTEM)
      db.message.count({
        where: { tenantId, direction: 'SYSTEM', ...dateFilter },
      }),
    ]);

    // --- Message status counts ---
    const statusMap: Record<string, number> = {};
    for (const ms of messageStatusGroups) {
      statusMap[ms.status] = ms._count;
    }

    const sent = statusMap['SENT'] ?? 0;
    const delivered = statusMap['DELIVERED'] ?? 0;
    const read = statusMap['READ'] ?? 0;
    const failed = statusMap['FAILED'] ?? 0;

    // --- Channel distribution ---
    const channelDistribution = channelGroups.map((g) => ({
      channel: g.channel,
      count: g._count,
    }));

    return NextResponse.json(
      success({
        sent,
        delivered,
        read,
        failed,
        channelDistribution,
        automationGenerated: automationGeneratedCount,
      }),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
