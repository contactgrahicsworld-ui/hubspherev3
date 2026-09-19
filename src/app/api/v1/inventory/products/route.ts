import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate, safeStringField } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  ValidationError,
} from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const createProductSchema = z.object({
  sku: safeStringField(1, 100),
  name: safeStringField(1, 300),
  description: safeStringField(undefined, 5000).optional(),
  category: safeStringField(undefined, 200).optional(),
  unit: safeStringField(undefined, 50).optional(),
  unitPrice: z.number().min(0).optional().default(0),
  costPrice: z.number().min(0).optional().default(0),
  stockQuantity: z.number().min(0).optional().default(0),
  reorderLevel: z.number().min(0).optional().default(0),
  reorderQuantity: z.number().min(0).optional().default(0),
  warehouse: safeStringField(undefined, 200).optional(),
  isActive: z.boolean().optional().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// GET /api/v1/inventory/products — List products
// ============================================

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

    const search = searchParams.get('search') ?? '';
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');
    const sortBy = searchParams.get('sortBy') ?? 'createdAt';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';

    const where: Record<string, unknown> = { tenantId: payload.tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = category;
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true';

    const validSortFields = ['createdAt', 'updatedAt', 'name', 'sku', 'unitPrice', 'stockQuantity'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [orderField]: orderDirection },
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json(paginated(products, total, page, limit));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/inventory/products — Create product
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'inventory.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(createProductSchema, body);

    // Check for duplicate SKU within tenant
    const existing = await db.product.findFirst({
      where: { tenantId: payload.tenantId, sku: data.sku },
    });
    if (existing) {
      throw new ValidationError('A product with this SKU already exists');
    }

    const product = await db.product.create({
      data: {
        tenantId: payload.tenantId,
        sku: data.sku,
        name: data.name,
        description: data.description ?? null,
        category: data.category ?? null,
        unit: data.unit ?? 'EACH',
        unitPrice: data.unitPrice,
        costPrice: data.costPrice,
        stockQuantity: data.stockQuantity,
        reorderLevel: data.reorderLevel,
        reorderQuantity: data.reorderQuantity,
        warehouse: data.warehouse ?? null,
        isActive: data.isActive,
        metadata: (data.metadata as any) ?? undefined,
      },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'product.create',
      targetType: 'Product',
      targetId: product.id,
      metadata: { sku: data.sku, name: data.name },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(product, 'Product created successfully'), { status: 201 });
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
