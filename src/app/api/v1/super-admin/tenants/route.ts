import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createTenantSchema, paginationSchema, validate } from '@/lib/validators';
import { handleApiError, AuthorizationError } from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.isSuperAdmin) {
      throw new AuthorizationError('Super admin access required');
    }

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const [tenants, total] = await Promise.all([
      db.tenant.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { memberships: true } },
        },
      }),
      db.tenant.count(),
    ]);

    const data = tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      domain: t.domain,
      status: t.status,
      plan: t.plan,
      maxUsers: t.maxUsers,
      userCount: t._count.memberships,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return NextResponse.json(paginated(data, total, page, limit));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.isSuperAdmin) {
      throw new AuthorizationError('Super admin access required');
    }

    const body = await request.json();
    const data = validate(createTenantSchema, body);

    const tenant = await db.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        domain: data.domain ?? null,
      },
    });

    await createAuditLog({
      actorId: payload.userId,
      action: 'tenant.create',
      targetType: 'Tenant',
      targetId: tenant.id,
      metadata: { name: tenant.name, slug: tenant.slug },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        domain: tenant.domain,
        status: tenant.status,
      }, 'Tenant created successfully'),
      { status: 201 }
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
