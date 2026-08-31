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
// GET /api/v1/hrms/field-dashboard — Field Sales Dashboard
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'field.view', payload.tenantId, payload.isSuperAdmin);

    const tenantId = payload.tenantId;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    // Run all queries in parallel
    const [
      todayVisits,
      completedToday,
      pendingVisits,
      missedToday,
      followUpsDue,
      fieldEmployeeCount,
      pendingExpenses,
    ] = await Promise.all([
      // Today's visits (all)
      db.fieldVisit.count({
        where: {
          tenantId,
          date: { gte: todayStart, lt: todayEnd },
        },
      }),

      // Completed visits today
      db.fieldVisit.count({
        where: {
          tenantId,
          date: { gte: todayStart, lt: todayEnd },
          status: 'COMPLETED',
        },
      }),

      // Pending/planned visits
      db.fieldVisit.count({
        where: {
          tenantId,
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
        },
      }),

      // Missed visits today
      db.fieldVisit.count({
        where: {
          tenantId,
          date: { lt: todayStart },
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
        },
      }),

      // Follow-ups due (nextFollowUp <= today)
      db.fieldVisit.count({
        where: {
          tenantId,
          nextFollowUp: { lte: todayEnd },
          status: { notIn: ['CANCELLED'] },
        },
      }),

      // Distinct field employees
      db.fieldVisit.groupBy({
        by: ['employeeId'],
        where: { tenantId },
      }).then((groups) => groups.length),

      // Expenses pending approval
      db.expense.count({
        where: {
          tenantId,
          status: 'PENDING',
        },
      }),
    ]);

    return NextResponse.json(
      success({
        visits: {
          today: todayVisits,
          completedToday,
          pending: pendingVisits,
          missedToday,
        },
        followUps: {
          due: followUpsDue,
        },
        fieldEmployees: {
          count: fieldEmployeeCount,
        },
        expenses: {
          pendingApproval: pendingExpenses,
        },
      }),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
