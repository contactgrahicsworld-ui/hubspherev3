import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
} from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ============================================
// HELPERS
// ============================================

function isDbError(error: unknown) {
  return error instanceof Error && (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'));
}

function dbUnavailableResponse() {
  return NextResponse.json(
    { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
    { status: 503 },
  );
}

// ============================================
// SCHEMAS
// ============================================

const checkInSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID format'),
  checkInLocation: z.record(z.unknown()).optional(),
  checkInDevice: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
});

// ============================================
// SHARED SELECT
// ============================================

const attendanceSelect = {
  id: true,
  tenantId: true,
  employeeId: true,
  date: true,
  checkInTime: true,
  checkOutTime: true,
  status: true,
  workingMinutes: true,
  breakMinutes: true,
  overtimeMinutes: true,
  lateMinutes: true,
  earlyExitMinutes: true,
  checkInLocation: true,
  checkOutLocation: true,
  checkInDevice: true,
  checkOutDevice: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
      designation: { select: { title: true } },
    },
  },
} as const;

// ============================================
// GET /api/v1/hrms/attendance — List attendance
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'attendance.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sortBy = searchParams.get('sortBy') ?? 'date';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.date = dateFilter;
    }

    const validSortFields = ['date', 'checkInTime', 'createdAt', 'status', 'workingMinutes'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'date';
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const [sessions, total] = await Promise.all([
      db.attendanceSession.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [orderField]: orderDirection },
        select: attendanceSelect,
      }),
      db.attendanceSession.count({ where }),
    ]);

    return NextResponse.json(paginated(sessions, total, page, limit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/hrms/attendance — Check-in
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'attendance.create', payload.tenantId);

    const body = await request.json();
    const data = validate(checkInSchema, body);

    // Verify employee exists and belongs to tenant
    const employee = await db.employee.findFirst({
      where: { id: data.employeeId, tenantId: payload.tenantId, archived: false },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    // Check for existing session today
    const existingSession = await db.attendanceSession.findFirst({
      where: {
        employeeId: data.employeeId,
        date: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    });

    if (existingSession) {
      throw new ConflictError('Attendance session already exists for today');
    }

    // Determine if late (after 9:30 AM)
    const lateThreshold = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30, 0, 0);
    let sessionStatus = 'PRESENT';
    let lateMinutes: number | null = null;

    if (now > lateThreshold) {
      sessionStatus = 'LATE';
      lateMinutes = Math.round((now.getTime() - lateThreshold.getTime()) / 60000);
    }

    const session = await db.attendanceSession.create({
      data: {
        tenantId: payload.tenantId,
        employeeId: data.employeeId,
        date: now,
        checkInTime: now,
        status: sessionStatus,
        lateMinutes,
        checkInLocation: data.checkInLocation ?? undefined,
        checkInDevice: data.checkInDevice ?? undefined,
        notes: data.notes ?? undefined,
      },
      select: attendanceSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'attendance.checkin',
      targetType: 'AttendanceSession',
      targetId: session.id,
      metadata: {
        employeeId: data.employeeId,
        status: sessionStatus,
        lateMinutes,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(session, 'Checked in successfully'),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
