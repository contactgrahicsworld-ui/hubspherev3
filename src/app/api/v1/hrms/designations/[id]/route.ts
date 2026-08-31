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

const updateDesignationSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  status: z.string().trim().max(50).optional(),
});

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
// GET /api/v1/hrms/designations/:id
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

    await requirePermission(payload.roleCode ?? null, 'designations.view', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const designation = await db.designation.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: designationSelect,
    });

    if (!designation) {
      throw new NotFoundError('Designation not found');
    }

    return NextResponse.json(success(designation));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// PUT /api/v1/hrms/designations/:id
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

    await requirePermission(payload.roleCode ?? null, 'designations.edit', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const existing = await db.designation.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Designation not found');
    }

    const body = await request.json();
    const data = validate(updateDesignationSchema, body);

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
    if (data.status !== undefined) updateData.status = data.status;

    const designation = await db.designation.update({
      where: { id },
      data: updateData,
      select: designationSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'designation.update',
      targetType: 'Designation',
      targetId: id,
      metadata: updateData,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(designation, 'Designation updated successfully'),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// DELETE /api/v1/hrms/designations/:id
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

    await requirePermission(payload.roleCode ?? null, 'designations.delete', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const existing = await db.designation.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Designation not found');
    }

    await db.designation.delete({ where: { id } });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'designation.delete',
      targetType: 'Designation',
      targetId: id,
      metadata: { title: existing.title },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Designation deleted successfully'));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
