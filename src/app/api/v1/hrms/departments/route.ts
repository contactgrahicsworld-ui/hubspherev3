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

const createDepartmentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  code: z.string().trim().max(50).optional(),
  description: z.string().max(5000).optional(),
  headId: z.string().uuid().optional(),
  status: z.string().trim().max(50).optional(),
});

type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

// ============================================
// SHARED SELECT
// ============================================

const departmentSelect = {
  id: true,
  tenantId: true,
  name: true,
  code: true,
  description: true,
  headId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  head: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  _count: {
    select: { employees: true },
  },
} as const;

// ============================================
// GET /api/v1/hrms/departments — List departments
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'departments.view', payload.tenantId);

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

    const [departments, total] = await Promise.all([
      db.department.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: departmentSelect,
      }),
      db.department.count({ where }),
    ]);

    const formatted = departments.map((dept) => ({
      ...dept,
      employeeCount: dept._count.employees,
      _count: undefined,
    }));

    return NextResponse.json(paginated(formatted, total, page, limit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/hrms/departments — Create department
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'departments.create', payload.tenantId);

    const body = await request.json();
    const data = validate(createDepartmentSchema, body);

    const department = await db.department.create({
      data: {
        tenantId: payload.tenantId,
        name: data.name,
        code: data.code ?? null,
        description: data.description ?? null,
        headId: data.headId ?? null,
        status: data.status ?? 'ACTIVE',
      },
      select: departmentSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'department.create',
      targetType: 'Department',
      targetId: department.id,
      metadata: { name: data.name, code: data.code, status: data.status },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    const formatted = {
      ...department,
      employeeCount: department._count.employees,
      _count: undefined,
    };

    return NextResponse.json(
      success(formatted, 'Department created successfully'),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
