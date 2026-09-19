import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate, safeStringField } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validateUuid(id: string): void {
  if (!UUID_RE.test(id)) throw new NotFoundError('Resource not found');
}

const updateProductSchema = z.object({
  sku: safeStringField(1, 100).optional(),
  name: safeStringField(1, 300).optional(),
  description: safeStringField(undefined, 5000).optional(),
  category: safeStringField(undefined, 200).optional(),
  unit: safeStringField(undefined, 50).optional(),
  unitPrice: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  stockQuantity: z.number().min(0).optional(),
  reorderLevel: z.number().min(0).optional(),
  reorderQuantity: z.number().min(0).optional(),
  warehouse: safeStringField(undefined, 200).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// GET /api/v1/inventory/products/:id
// ============================================

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

    const product = await db.product.findFirst({
      where: { id, tenantId: payload.tenantId },
    });

    if (!product) throw new NotFoundError('Product not found');
    return NextResponse.json(success(product));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// PATCH /api/v1/inventory/products/:id
// ============================================

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

    const existing = await db.product.findFirst({ where: { id, tenantId: payload.tenantId } });
    if (!existing) throw new NotFoundError('Product not found');

    const body = await request.json();
    const data = validate(updateProductSchema, body);

    // Check SKU uniqueness if changing
    if (data.sku && data.sku !== existing.sku) {
      const skuConflict = await db.product.findFirst({
        where: { tenantId: payload.tenantId, sku: data.sku, id: { not: id } },
      });
      if (skuConflict) throw new ValidationError('A product with this SKU already exists');
    }

    const updateData: Record<string, unknown> = {};
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description ?? null;
    if (data.category !== undefined) updateData.category = data.category ?? null;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.unitPrice !== undefined) updateData.unitPrice = data.unitPrice;
    if (data.costPrice !== undefined) updateData.costPrice = data.costPrice;
    if (data.stockQuantity !== undefined) updateData.stockQuantity = data.stockQuantity;
    if (data.reorderLevel !== undefined) updateData.reorderLevel = data.reorderLevel;
    if (data.reorderQuantity !== undefined) updateData.reorderQuantity = data.reorderQuantity;
    if (data.warehouse !== undefined) updateData.warehouse = data.warehouse ?? null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.metadata !== undefined) updateData.metadata = data.metadata as any;

    const product = await db.product.update({ where: { id }, data: updateData });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'product.update',
      targetType: 'Product',
      targetId: id,
      metadata: updateData,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(product, 'Product updated successfully'));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// DELETE /api/v1/inventory/products/:id
// ============================================

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

    const existing = await db.product.findFirst({ where: { id, tenantId: payload.tenantId } });
    if (!existing) throw new NotFoundError('Product not found');

    await db.product.delete({ where: { id } });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'product.delete',
      targetType: 'Product',
      targetId: id,
      metadata: { sku: existing.sku, name: existing.name },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Product deleted successfully'));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
