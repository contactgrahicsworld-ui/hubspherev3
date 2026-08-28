import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
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

const createLeaveRequestSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID format'),
  leaveTypeId: z.string().uuid('Invalid leave type ID format'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  totalDays: z.number().min(0.5).optional(),
  reason: z.string().max(5000).optional(),
});

type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

// ============================================
// SHARED SELECT
// ============================================

const leaveRequestSelect = {
  id: true,
  tenantId: true,
  employeeId: true,
  leaveTypeId: true,
  startDate: true,
  endDate: true,
  totalDays: true,
  reason: true,
  status: true,
  approvedBy: true,
  approvedAt: true,
  rejectionReason: true,
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
  leaveType: {
    select: { id: true, name: true, code: true, paid: true },
  },
  approver: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
} as const;

// ============================================
// GET /api/v1/hrms/leave-requests — List leave requests
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'leave.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const leaveTypeId = searchParams.get('leaveTypeId');
    const sortBy = searchParams.get('sortBy') ?? 'createdAt';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (leaveTypeId) where.leaveTypeId = leaveTypeId;

    const validSortFields = ['createdAt', 'updatedAt', 'startDate', 'status', 'totalDays'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const [leaveRequests, total] = await Promise.all([
      db.leaveRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [orderField]: orderDirection },
        select: leaveRequestSelect,
      }),
      db.leaveRequest.count({ where }),
    ]);

    return NextResponse.json(paginated(leaveRequests, total, page, limit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/hrms/leave-requests — Create leave request
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'leave.create', payload.tenantId);

    const body = await request.json();
    const data = validate(createLeaveRequestSchema, body);

    // Verify employee exists and belongs to tenant
    const employee = await db.employee.findFirst({
      where: { id: data.employeeId, tenantId: payload.tenantId, archived: false },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    // Verify leave type exists and belongs to tenant
    const leaveType = await db.leaveType.findFirst({
      where: { id: data.leaveTypeId, tenantId: payload.tenantId },
      select: { id: true },
    });

    if (!leaveType) {
      throw new NotFoundError('Leave type not found');
    }

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (end < start) {
      const { ValidationError } = await import('@/lib/errors');
      throw new ValidationError('End date must be on or after start date');
    }

    // Calculate totalDays if not provided
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
    const totalDays = data.totalDays ?? diffDays;

    const leaveRequest = await db.leaveRequest.create({
      data: {
        tenantId: payload.tenantId,
        employeeId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        startDate: start,
        endDate: end,
        totalDays,
        reason: data.reason ?? null,
      },
      select: leaveRequestSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'leave_request.create',
      targetType: 'LeaveRequest',
      targetId: leaveRequest.id,
      metadata: {
        employeeId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        startDate: data.startDate,
        endDate: data.endDate,
        totalDays,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(leaveRequest, 'Leave request created successfully'),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
