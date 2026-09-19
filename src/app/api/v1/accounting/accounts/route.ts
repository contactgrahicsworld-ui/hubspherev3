import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate, safeStringField } from '@/lib/validators';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const createAccountSchema = z.object({
  code: safeStringField(1, 50),
  name: safeStringField(1, 300),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  category: safeStringField(undefined, 200).optional(),
  parentId: z.string().uuid().optional(),
  isActive: z.boolean().optional().default(true),
  balance: z.number().optional().default(0),
});

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);
    if (!payload.tenantId) throw new AuthenticationError('Tenant context required');
    await requirePermission(payload.roleCode ?? null, 'accounting.view', payload.tenantId, payload.isSuperAdmin);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '50',
    });

    const type = searchParams.get('type');
    const isActive = searchParams.get('isActive');
    const where: Record<string, unknown> = { tenantId: payload.tenantId };
    if (type) where.type = type;
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === 'true';

    const [accounts, total] = await Promise.all([
      db.account.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { code: 'asc' },
      }),
      db.account.count({ where }),
    ]);

    return NextResponse.json(paginated(accounts, total, page, limit));
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
    await requirePermission(payload.roleCode ?? null, 'accounting.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(createAccountSchema, body);

    const existing = await db.account.findFirst({
      where: { tenantId: payload.tenantId, code: data.code },
    });
    if (existing) throw new ValidationError('An account with this code already exists');

    const account = await db.account.create({
      data: {
        tenantId: payload.tenantId,
        code: data.code,
        name: data.name,
        type: data.type,
        category: data.category ?? null,
        parentId: data.parentId ?? null,
        isActive: data.isActive,
        balance: data.balance,
      },
    });

    await createAuditLog({
      actorId: payload.userId, tenantId: payload.tenantId,
      action: 'account.create', targetType: 'Account', targetId: account.id,
      metadata: { code: data.code, name: data.name, type: data.type },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(account, 'Account created successfully'), { status: 201 });
  } catch (err) {
    if (err instanceof Error && (err.message?.includes('connect') || err.message?.includes('ECONNREFUSED'))) {
      return NextResponse.json({ success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }
    const { statusCode, body } = handleApiError(err);
    return NextResponse.json(body, { status: statusCode });
  }
}
