import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
} from '@/lib/errors';
import { success } from '@/lib/api-response';
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

const updateDepartmentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200).optional(),
  code: z.string().trim().max(50).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  headId: z.string().uuid().nullable().optional(),
  status: z.string().trim().max(50).optional(),
});

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
// GET /api/v1/hrms/departments/:id
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'departments.view', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const department = await db.department.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: departmentSelect,
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    const formatted = {
      ...department,
      employeeCount: department._count.employees,
      _count: undefined,
    };

    return NextResponse.json(success(formatted));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// PUT /api/v1/hrms/departments/:id
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

    await requirePermission(payload.roleCode ?? null, 'departments.edit', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const existing = await db.department.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Department not found');
    }

    const body = await request.json();
    const data = validate(updateDepartmentSchema, body);

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.headId !== undefined) updateData.headId = data.headId;
    if (data.status !== undefined) updateData.status = data.status;

    const department = await db.department.update({
      where: { id },
      data: updateData,
      select: departmentSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'department.update',
      targetType: 'Department',
      targetId: id,
      metadata: updateData,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    const formatted = {
      ...department,
      employeeCount: department._count.employees,
      _count: undefined,
    };

    return NextResponse.json(
      success(formatted, 'Department updated successfully'),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// DELETE /api/v1/hrms/departments/:id
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'departments.delete', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const existing = await db.department.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Department not found');
    }

    await db.department.delete({ where: { id } });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'department.delete',
      targetType: 'Department',
      targetId: id,
      metadata: { name: existing.name, code: existing.code },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Department deleted successfully'));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
