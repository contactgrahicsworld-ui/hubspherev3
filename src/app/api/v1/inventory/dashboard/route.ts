import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'inventory.view', payload.tenantId, payload.isSuperAdmin);

    const tenantId = payload.tenantId;

    const [
      totalProducts,
      activeProducts,
      lowStockProducts,
      totalVendors,
      recentMovements,
      pendingOrders,
    ] = await Promise.all([
      db.product.count({ where: { tenantId } }),
      db.product.count({ where: { tenantId, isActive: true } }),
      db.product.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, sku: true, stockQuantity: true, reorderLevel: true, unit: true },
      }),
      db.vendor.count({ where: { tenantId, isActive: true } }),
      db.stockMovement.findMany({
        where: { tenantId },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { id: true, name: true, sku: true } } },
      }),
      db.purchaseOrder.count({ where: { tenantId, status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } } }),
    ]);

    // Filter low stock items
    const lowStockItems = lowStockProducts.filter(
      (p) => p.stockQuantity <= p.reorderLevel
    );

    // Calculate total stock value
    const stockValueResult = await db.product.aggregate({
      where: { tenantId, isActive: true },
      _sum: { unitPrice: true },
    });

    const totalStockValue = stockValueResult._sum.unitPrice ?? 0;

    return NextResponse.json(success({
      totalProducts,
      activeProducts,
      lowStockCount: lowStockItems.length,
      lowStockItems,
      totalVendors,
      totalStockValue,
      pendingOrders,
      recentMovements,
    }));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
