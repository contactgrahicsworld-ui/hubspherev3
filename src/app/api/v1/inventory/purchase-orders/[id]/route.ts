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

const updatePurchaseOrderSchema = z.object({
  vendorId: z.string().uuid().optional(),
  vendorName: safeStringField(1, 300).optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'RECEIVED', 'CANCELLED']).optional(),
  items: z.array(z.record(z.string(), z.unknown())).optional(),
  totalAmount: z.number().min(0).optional(),
  expectedDate: z.string().datetime().optional(),
  notes: safeStringField(undefined, 5000).optional(),
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

    const order = await db.purchaseOrder.findFirst({
      where: { id, tenantId: payload.tenantId },
    });
    if (!order) throw new NotFoundError('Purchase order not found');

    return NextResponse.json(success(order));
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

    const existing = await db.purchaseOrder.findFirst({ where: { id, tenantId: payload.tenantId } });
    if (!existing) throw new NotFoundError('Purchase order not found');

    const body = await request.json();
    const data = validate(updatePurchaseOrderSchema, body);

    const updateData: Record<string, unknown> = {};
    if (data.vendorId !== undefined) updateData.vendorId = data.vendorId;
    if (data.vendorName !== undefined) updateData.vendorName = data.vendorName;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.items !== undefined) updateData.items = data.items as any;
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;
    if (data.expectedDate !== undefined) updateData.expectedDate = new Date(data.expectedDate);
    if (data.notes !== undefined) updateData.notes = data.notes ?? null;

    const order = await db.purchaseOrder.update({ where: { id }, data: updateData });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'purchaseOrder.update',
      targetType: 'PurchaseOrder',
      targetId: id,
      metadata: updateData,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(order, 'Purchase order updated successfully'));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
