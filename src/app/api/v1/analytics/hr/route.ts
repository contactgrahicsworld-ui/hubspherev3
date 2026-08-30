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
// GET /api/v1/analytics/hr — HR Analytics KPIs
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'employees.view', payload.tenantId, payload.isSuperAdmin);

    const tenantId = payload.tenantId;

    // Parse optional date range
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const dateFilter: { date?: { gte?: Date; lte?: Date } } = {};
    if (dateFrom) dateFilter.date = { ...dateFilter.date, gte: new Date(dateFrom) };
    if (dateTo) dateFilter.date = { ...dateFilter.date, lte: new Date(dateTo) };

    const createdDateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (dateFrom) createdDateFilter.createdAt = { ...createdDateFilter.createdAt, gte: new Date(dateFrom) };
    if (dateTo) createdDateFilter.createdAt = { ...createdDateFilter.createdAt, lte: new Date(dateTo) };

    const periodStartFilter: { periodStart?: { gte?: Date; lte?: Date } } = {};
    if (dateFrom) periodStartFilter.periodStart = { ...periodStartFilter.periodStart, gte: new Date(dateFrom) };
    if (dateTo) periodStartFilter.periodStart = { ...periodStartFilter.periodStart, lte: new Date(dateTo) };

    // Run all queries in parallel
    const [
      attendanceTrends,
      leaveTrends,
      departmentDistribution,
      employeeStatusDistribution,
      fieldVisitActivity,
      expenseAgg,
      expenseStatusAgg,
      payrollStatusAgg,
    ] = await Promise.all([
      // 1. Attendance trends — counts by status within date range
      db.attendanceSession.groupBy({
        by: ['status'],
        where: { tenantId, ...dateFilter },
        _count: true,
      }),

      // 2. Leave trends — counts by status within date range
      db.leaveRequest.groupBy({
        by: ['status'],
        where: { tenantId, ...createdDateFilter },
        _count: true,
      }),

      // 3. Department distribution — employee count per department
      db.employee.groupBy({
        by: ['departmentId'],
        where: { tenantId, archived: false, departmentId: { not: null } },
        _count: true,
        // We need department names, so fetch departments separately
      }),

      // 4. Employee status distribution
      db.employee.groupBy({
        by: ['employmentStatus'],
        where: { tenantId, archived: false },
        _count: true,
      }),

      // 5. Field visit activity — counts by status within date range
      db.fieldVisit.groupBy({
        by: ['status'],
        where: { tenantId, ...dateFilter },
        _count: true,
      }),

      // 6. Expense trends — total amount
      db.expense.aggregate({
        where: { tenantId, ...dateFilter },
        _sum: { amount: true },
        _count: true,
      }),

      // 7. Expense trends — by status
      db.expense.groupBy({
        by: ['status'],
        where: { tenantId, ...dateFilter },
        _sum: { amount: true },
        _count: true,
      }),

      // 8. Payroll status distribution
      db.payrollRecord.groupBy({
        by: ['status'],
        where: { tenantId, ...periodStartFilter },
        _count: true,
      }),
    ]);

    // Fetch department names for the distribution
    const departmentIds = departmentDistribution.map((d) => d.departmentId).filter((id): id is string => id !== null);
    const departments = departmentIds.length > 0
      ? await db.department.findMany({
          where: { id: { in: departmentIds } },
          select: { id: true, name: true },
        })
      : [];

    const deptMap = new Map(departments.map((d) => [d.id, d.name]));

    // Build attendance trends map
    const attendanceMap: Record<string, number> = {};
    for (const item of attendanceTrends) {
      attendanceMap[item.status] = item._count;
    }

    // Build leave trends map
    const leaveMap: Record<string, number> = {};
    for (const item of leaveTrends) {
      leaveMap[item.status] = item._count;
    }

    // Build department distribution
    const departmentData = departmentDistribution
      .map((item) => ({
        departmentId: item.departmentId,
        departmentName: item.departmentId ? (deptMap.get(item.departmentId) ?? 'Unknown') : 'Unassigned',
        employeeCount: item._count,
      }))
      .sort((a, b) => b.employeeCount - a.employeeCount);

    // Build employee status distribution
    const employeeStatusData = employeeStatusDistribution.map((item) => ({
      status: item.employmentStatus,
      count: item._count,
    }));

    // Build field visit activity map
    const fieldVisitMap: Record<string, number> = {};
    for (const item of fieldVisitActivity) {
      fieldVisitMap[item.status] = item._count;
    }

    // Build expense summary
    const expenseStatusMap: Record<string, { count: number; amount: number }> = {};
    for (const item of expenseStatusAgg) {
      expenseStatusMap[item.status] = {
        count: item._count,
        amount: item._sum.amount ?? 0,
      };
    }

    return NextResponse.json(
      success({
        attendanceTrends: {
          present: attendanceMap['PRESENT'] ?? 0,
          absent: attendanceMap['ABSENT'] ?? 0,
          late: attendanceMap['LATE'] ?? 0,
          halfDay: attendanceMap['HALF_DAY'] ?? 0,
          onLeave: attendanceMap['ON_LEAVE'] ?? 0,
          holiday: attendanceMap['HOLIDAY'] ?? 0,
          weekOff: attendanceMap['WEEK_OFF'] ?? 0,
          total: attendanceTrends.reduce((sum, item) => sum + item._count, 0),
        },
        leaveTrends: {
          approved: leaveMap['APPROVED'] ?? 0,
          rejected: leaveMap['REJECTED'] ?? 0,
          pending: leaveMap['PENDING'] ?? 0,
          cancelled: leaveMap['CANCELLED'] ?? 0,
          total: leaveTrends.reduce((sum, item) => sum + item._count, 0),
        },
        departmentDistribution: departmentData,
        employeeStatus: employeeStatusData,
        fieldVisitActivity: fieldVisitMap,
        expenseTrends: {
          totalAmount: expenseAgg._sum.amount ?? 0,
          totalCount: expenseAgg._count,
          approved: expenseStatusMap['APPROVED'] ?? { count: 0, amount: 0 },
          pending: expenseStatusMap['PENDING'] ?? { count: 0, amount: 0 },
          rejected: expenseStatusMap['REJECTED'] ?? { count: 0, amount: 0 },
          paid: expenseStatusMap['PAID'] ?? { count: 0, amount: 0 },
        },
        payrollStatus: {
          draft: payrollStatusAgg.find((p) => p.status === 'DRAFT')?._count ?? 0,
          processing: payrollStatusAgg.find((p) => p.status === 'PROCESSING')?._count ?? 0,
          finalized: payrollStatusAgg.find((p) => p.status === 'FINALIZED')?._count ?? 0,
          paid: payrollStatusAgg.find((p) => p.status === 'PAID')?._count ?? 0,
          cancelled: payrollStatusAgg.find((p) => p.status === 'CANCELLED')?._count ?? 0,
          total: payrollStatusAgg.reduce((sum, item) => sum + item._count, 0),
        },
      }),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
