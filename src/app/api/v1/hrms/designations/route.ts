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

const createDesignationSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  departmentId: z.string().uuid().optional(),
  status: z.string().trim().max(50).optional(),
});

type CreateDesignationInput = z.infer<typeof createDesignationSchema>;

// ============================================
// SHARED SELECT
// ============================================

const designationSelect = {
  id: true,
  tenantId: true,
  title: true,
  description: true,
  departmentId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  department: {
    select: { id: true, name: true },
  },
} as const;

// ============================================
// GET /api/v1/hrms/designations — List designations
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'designations.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const search = searchParams.get('search') ?? '';
    const departmentId = searchParams.get('departmentId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;

    const [designations, total] = await Promise.all([
      db.designation.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: designationSelect,
      }),
      db.designation.count({ where }),
    ]);

    return NextResponse.json(paginated(designations, total, page, limit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/hrms/designations — Create designation
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'designations.create', payload.tenantId);

    const body = await request.json();
    const data = validate(createDesignationSchema, body);

    const designation = await db.designation.create({
      data: {
        tenantId: payload.tenantId,
        title: data.title,
        description: data.description ?? null,
        departmentId: data.departmentId ?? null,
        status: data.status ?? 'ACTIVE',
      },
      select: designationSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'designation.create',
      targetType: 'Designation',
      targetId: designation.id,
      metadata: { title: data.title, departmentId: data.departmentId, status: data.status },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(designation, 'Designation created successfully'),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
