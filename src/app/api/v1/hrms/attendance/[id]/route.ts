import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
} from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { Prisma } from '@prisma/client';
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

const checkOutSchema = z.object({
  checkOutLocation: z.record(z.string(), z.unknown()).optional(),
  checkOutDevice: z.string().max(100).optional(),
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
// PUT /api/v1/hrms/attendance/:id — Check-out
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'attendance.edit', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const session = await db.attendanceSession.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!session) {
      throw new NotFoundError('Attendance session not found');
    }

    if (session.checkOutTime) {
      throw new ConflictError('Already checked out for this session');
    }

    const body = await request.json();
    const data = checkOutSchema.safeParse(body);
    const parsed = data.success ? data.data : {};

    const now = new Date();
    const checkInTime = session.checkInTime ?? now;
    const workingMinutes = Math.round((now.getTime() - checkInTime.getTime()) / 60000);

    // Determine early exit (before 6 hours)
    const normalWorkHours = 360; // 6 hours in minutes
    let earlyExitMinutes: number | null = null;

    if (workingMinutes < normalWorkHours) {
      earlyExitMinutes = normalWorkHours - workingMinutes;
    }

    // If working less than 4 hours, mark as HALF_DAY
    let finalStatus = session.status;
    if (workingMinutes < 240) {
      finalStatus = 'HALF_DAY';
    }

    const updatedSession = await db.attendanceSession.update({
      where: { id },
      data: {
        checkOutTime: now,
        workingMinutes,
        earlyExitMinutes,
        status: finalStatus,
        checkOutLocation: parsed.checkOutLocation as unknown as Prisma.InputJsonValue | undefined,
        checkOutDevice: parsed.checkOutDevice ?? undefined,
        notes: parsed.notes ?? undefined,
      },
      select: attendanceSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'attendance.checkout',
      targetType: 'AttendanceSession',
      targetId: id,
      metadata: {
        workingMinutes,
        status: finalStatus,
        earlyExitMinutes,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(updatedSession, 'Checked out successfully'),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
