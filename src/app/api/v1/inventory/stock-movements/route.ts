import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate, safeStringField } from '@/lib/validators';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const createStockMovementSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER']),
  quantity: z.number().positive(),
  referenceType: safeStringField(undefined, 100).optional(),
  referenceId: z.string().uuid().optional(),
  notes: safeStringField(undefined, 2000).optional(),
  performedBy: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'inventory.view', payload.tenantId, payload.isSuperAdmin);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const productId = searchParams.get('productId');
    const type = searchParams.get('type');

    const where: Record<string, unknown> = { tenantId: payload.tenantId };
    if (productId) where.productId = productId;
    if (type) where.type = type;

    const [movements, total] = await Promise.all([
      db.stockMovement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
      }),
      db.stockMovement.count({ where }),
    ]);

    return NextResponse.json(paginated(movements, total, page, limit));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'inventory.edit', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(createStockMovementSchema, body);

    // Verify product belongs to tenant
    const product = await db.product.findFirst({
      where: { id: data.productId, tenantId: payload.tenantId },
    });
    if (!product) {
      const { NotFoundError } = await import('@/lib/errors');
      throw new NotFoundError('Product not found');
    }

    const movement = await db.stockMovement.create({
      data: {
        tenantId: payload.tenantId,
        productId: data.productId,
        type: data.type,
        quantity: data.quantity,
        referenceType: data.referenceType ?? null,
        referenceId: data.referenceId ?? null,
        notes: data.notes ?? null,
        performedBy: data.performedBy ?? payload.userId,
      },
    });

    // Update product stock quantity
    const stockChange = data.type === 'IN' ? data.quantity : data.type === 'OUT' ? -data.quantity : 0;
    if (stockChange !== 0) {
      await db.product.update({
        where: { id: data.productId },
        data: { stockQuantity: { increment: stockChange } },
      });
    }

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'stockMovement.create',
      targetType: 'StockMovement',
      targetId: movement.id,
      metadata: { productId: data.productId, type: data.type, quantity: data.quantity },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(movement, 'Stock movement recorded successfully'), { status: 201 });
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
