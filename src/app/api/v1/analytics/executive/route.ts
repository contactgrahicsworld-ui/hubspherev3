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
// GET /api/v1/analytics/executive — Executive Dashboard KPIs
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'dashboard.view', payload.tenantId, payload.isSuperAdmin);

    const tenantId = payload.tenantId;

    // Parse optional date range
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (dateFrom) dateFilter.createdAt = { ...dateFilter.createdAt, gte: new Date(dateFrom) };
    if (dateTo) dateFilter.createdAt = { ...dateFilter.createdAt, lte: new Date(dateTo) };

    // Today boundaries for attendance
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    // Run all queries in parallel
    const [
      totalEmployees,
      totalLeads,
      totalDeals,
      wonDealsAgg,
      activeConversations,
      openTasks,
      todayAttendance,
    ] = await Promise.all([
      // Total employees (current count, not date-filtered)
      db.employee.count({
        where: { tenantId, archived: false },
      }),

      // Total leads
      db.lead.count({
        where: { tenantId, archived: false, ...dateFilter },
      }),

      // Total deals
      db.deal.count({
        where: { tenantId, archived: false, ...dateFilter },
      }),

      // Won deals value sum
      db.deal.aggregate({
        where: { tenantId, stage: 'WON', archived: false, ...dateFilter },
        _sum: { value: true },
      }),

      // Active conversations
      db.conversation.count({
        where: { tenantId, status: 'ACTIVE', ...dateFilter },
      }),

      // Open tasks (TODO + IN_PROGRESS)
      db.task.count({
        where: {
          tenantId,
          status: { in: ['TODO', 'IN_PROGRESS'] },
          ...dateFilter,
        },
      }),

      // Today's attendance
      db.attendanceSession.count({
        where: {
          tenantId,
          date: { gte: todayStart, lt: todayEnd },
        },
      }),
    ]);

    return NextResponse.json(
      success({
        totalEmployees,
        totalLeads,
        totalDeals,
        totalRevenue: wonDealsAgg._sum.value ?? 0,
        activeConversations,
        openTasks,
        todaysAttendance: todayAttendance,
      }),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
