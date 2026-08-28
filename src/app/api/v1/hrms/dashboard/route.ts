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
// GET /api/v1/hrms/dashboard — HR Dashboard metrics
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'employees.view', payload.tenantId);

    const tenantId = payload.tenantId;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    // Run all queries in parallel
    const [
      totalEmployees,
      activeEmployees,
      presentToday,
      onLeaveToday,
      lateToday,
      pendingLeaveRequests,
      pendingExpenses,
      payrollByStatus,
    ] = await Promise.all([
      // Total employees (not archived)
      db.employee.count({
        where: { tenantId, archived: false },
      }),

      // Active employees
      db.employee.count({
        where: { tenantId, archived: false, employmentStatus: 'ACTIVE' },
      }),

      // Present today (PRESENT, LATE, HALF_DAY)
      db.attendanceSession.count({
        where: {
          tenantId,
          date: { gte: todayStart, lt: todayEnd },
          status: { in: ['PRESENT', 'LATE', 'HALF_DAY'] },
        },
      }),

      // On leave today
      db.attendanceSession.count({
        where: {
          tenantId,
          date: { gte: todayStart, lt: todayEnd },
          status: 'ON_LEAVE',
        },
      }),

      // Late today
      db.attendanceSession.count({
        where: {
          tenantId,
          date: { gte: todayStart, lt: todayEnd },
          status: 'LATE',
        },
      }),

      // Pending leave requests
      db.leaveRequest.count({
        where: { tenantId, status: 'PENDING' },
      }),

      // Pending expenses
      db.expense.count({
        where: { tenantId, status: 'PENDING' },
      }),

      // Payroll status counts
      db.payrollRecord.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
    ]);

    // Absent today = total active - present - on leave
    const absentToday = activeEmployees - presentToday - onLeaveToday;

    // Format payroll status counts
    const payrollStatusMap: Record<string, number> = {};
    for (const ps of payrollByStatus) {
      payrollStatusMap[ps.status] = ps._count;
    }

    return NextResponse.json(
      success({
        employees: {
          total: totalEmployees,
          active: activeEmployees,
        },
        attendance: {
          presentToday,
          absentToday: Math.max(0, absentToday),
          onLeaveToday,
          lateToday,
        },
        leaveRequests: {
          pending: pendingLeaveRequests,
        },
        expenses: {
          pending: pendingExpenses,
        },
        payroll: {
          byStatus: payrollStatusMap,
        },
      }),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
