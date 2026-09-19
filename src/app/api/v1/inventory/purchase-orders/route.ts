import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate, safeStringField } from '@/lib/validators';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const createPurchaseOrderSchema = z.object({
  vendorId: z.string().uuid(),
  vendorName: safeStringField(1, 300),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'RECEIVED', 'CANCELLED']).optional().default('DRAFT'),
  items: z.array(z.record(z.string(), z.unknown())).min(1, 'At least one item is required'),
  totalAmount: z.number().min(0).optional().default(0),
  orderDate: z.string().datetime().optional(),
  expectedDate: z.string().datetime().optional(),
  notes: safeStringField(undefined, 5000).optional(),
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

    const status = searchParams.get('status');
    const where: Record<string, unknown> = { tenantId: payload.tenantId };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      db.purchaseOrder.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.purchaseOrder.count({ where }),
    ]);

    return NextResponse.json(paginated(orders, total, page, limit));
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
    await requirePermission(payload.roleCode ?? null, 'inventory.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(createPurchaseOrderSchema, body);

    const order = await db.purchaseOrder.create({
      data: {
        tenantId: payload.tenantId,
        vendorId: data.vendorId,
        vendorName: data.vendorName,
        status: data.status,
        items: data.items as any,
        totalAmount: data.totalAmount,
        orderDate: data.orderDate ? new Date(data.orderDate) : new Date(),
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
        notes: data.notes ?? null,
        createdBy: payload.userId,
      },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'purchaseOrder.create',
      targetType: 'PurchaseOrder',
      targetId: order.id,
      metadata: { vendorName: data.vendorName, status: data.status },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(order, 'Purchase order created successfully'), { status: 201 });
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
