import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
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

const createLeaveTypeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  code: z.string().trim().min(1, 'Code is required').max(50),
  description: z.string().max(5000).optional(),
  defaultDays: z.number().int().min(0).optional(),
  paid: z.boolean().optional(),
  carryForward: z.boolean().optional(),
  status: z.string().trim().max(50).optional(),
});

type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;

// ============================================
// SHARED SELECT
// ============================================

const leaveTypeSelect = {
  id: true,
  tenantId: true,
  name: true,
  code: true,
  description: true,
  defaultDays: true,
  paid: true,
  carryForward: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ============================================
// GET /api/v1/hrms/leave-types — List leave types
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

    const search = searchParams.get('search') ?? '';
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;

    const [leaveTypes, total] = await Promise.all([
      db.leaveType.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: leaveTypeSelect,
      }),
      db.leaveType.count({ where }),
    ]);

    return NextResponse.json(paginated(leaveTypes, total, page, limit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/hrms/leave-types — Create leave type
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'leave.create', payload.tenantId);

    const body = await request.json();
    const data = validate(createLeaveTypeSchema, body);

    const leaveType = await db.leaveType.create({
      data: {
        tenantId: payload.tenantId,
        name: data.name,
        code: data.code,
        description: data.description ?? null,
        defaultDays: data.defaultDays ?? 0,
        paid: data.paid ?? true,
        carryForward: data.carryForward ?? false,
        status: data.status ?? 'ACTIVE',
      },
      select: leaveTypeSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'leave_type.create',
      targetType: 'LeaveType',
      targetId: leaveType.id,
      metadata: { name: data.name, code: data.code, defaultDays: data.defaultDays, paid: data.paid },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(leaveType, 'Leave type created successfully'),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
