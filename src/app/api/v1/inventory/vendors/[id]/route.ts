import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate, safeStringField } from '@/lib/validators';
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validateUuid(id: string): void {
  if (!UUID_RE.test(id)) throw new NotFoundError('Resource not found');
}

const updateVendorSchema = z.object({
  name: safeStringField(1, 300).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: safeStringField(undefined, 50).optional(),
  address: safeStringField(undefined, 1000).optional(),
  category: safeStringField(undefined, 100).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'inventory.view', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;
    validateUuid(id);

    const vendor = await db.vendor.findFirst({ where: { id, tenantId: payload.tenantId } });
    if (!vendor) throw new NotFoundError('Vendor not found');

    return NextResponse.json(success(vendor));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'inventory.edit', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;
    validateUuid(id);

    const existing = await db.vendor.findFirst({ where: { id, tenantId: payload.tenantId } });
    if (!existing) throw new NotFoundError('Vendor not found');

    const body = await request.json();
    const data = validate(updateVendorSchema, body);

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.phone !== undefined) updateData.phone = data.phone ?? null;
    if (data.address !== undefined) updateData.address = data.address ?? null;
    if (data.category !== undefined) updateData.category = data.category ?? null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const vendor = await db.vendor.update({ where: { id }, data: updateData });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'vendor.update',
      targetType: 'Vendor',
      targetId: id,
      metadata: updateData,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(vendor, 'Vendor updated successfully'));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'inventory.delete', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;
    validateUuid(id);

    const existing = await db.vendor.findFirst({ where: { id, tenantId: payload.tenantId } });
    if (!existing) throw new NotFoundError('Vendor not found');

    await db.vendor.delete({ where: { id } });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'vendor.delete',
      targetType: 'Vendor',
      targetId: id,
      metadata: { name: existing.name },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Vendor deleted successfully'));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
