import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate, safeStringField } from '@/lib/validators';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const createBudgetSchema = z.object({
  accountId: z.string().uuid(),
  name: safeStringField(1, 300),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM format'),
  allocatedAmount: z.number().min(0),
  spentAmount: z.number().min(0).optional().default(0),
});

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'accounting.view', payload.tenantId, payload.isSuperAdmin);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const period = searchParams.get('period');
    const accountId = searchParams.get('accountId');
    const where: Record<string, unknown> = { tenantId: payload.tenantId };
    if (period) where.period = period;
    if (accountId) where.accountId = accountId;

    const [budgets, total] = await Promise.all([
      db.budget.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { period: 'desc' },
        // account relation not in schema
      }),
      db.budget.count({ where }),
    ]);

    return NextResponse.json(paginated(budgets, total, page, limit));
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err); return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'accounting.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json(); const data = validate(createBudgetSchema, body);

    const budget = await db.budget.create({
      data: {
        tenantId: payload.tenantId, accountId: data.accountId, name: data.name,
        period: data.period, allocatedAmount: data.allocatedAmount, spentAmount: data.spentAmount,
      },
    });

    await createAuditLog({
      actorId: payload.userId, tenantId: payload.tenantId,
      action: 'budget.create', targetType: 'Budget', targetId: budget.id,
      metadata: { name: data.name, period: data.period, allocatedAmount: data.allocatedAmount },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(budget, 'Budget created successfully'), { status: 201 });
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err); return NextResponse.json(body, { status: statusCode });
  }
}
