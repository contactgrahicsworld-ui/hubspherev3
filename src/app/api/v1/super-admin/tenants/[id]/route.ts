import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createTenantSchema, validate } from '@/lib/validators';
import { handleApiError, AuthorizationError, NotFoundError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.isSuperAdmin) {
      throw new AuthorizationError('Super admin access required');
    }

    const { id } = await params;

    const tenant = await db.tenant.findUnique({
      where: { id },
      include: {
        _count: { select: { memberships: true, roles: true } },
        featureFlags: {
          include: { featureFlag: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    return NextResponse.json(
      success({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        domain: tenant.domain,
        logoUrl: tenant.logoUrl,
        status: tenant.status,
        plan: tenant.plan,
        maxUsers: tenant.maxUsers,
        settings: tenant.settings,
        userCount: tenant._count.memberships,
        roleCount: tenant._count.roles,
        featureFlags: tenant.featureFlags.map((ff) => ({
          featureFlagId: ff.featureFlagId,
          key: ff.featureFlag.key,
          name: ff.featureFlag.name,
          enabled: ff.enabled,
        })),
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      })
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.isSuperAdmin) {
      throw new AuthorizationError('Super admin access required');
    }

    const { id } = await params;

    const existing = await db.tenant.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Tenant not found');
    }

    const body = await request.json();
    const data = validate(createTenantSchema, body);

    const tenant = await db.tenant.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        domain: data.domain ?? null,
      },
    });

    await createAuditLog({
      actorId: payload.userId,
      action: 'tenant.update',
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
      }, 'Tenant updated successfully')
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.isSuperAdmin) {
      throw new AuthorizationError('Super admin access required');
    }

    const { id } = await params;

    const existing = await db.tenant.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Tenant not found');
    }

    await db.tenant.delete({ where: { id } });

    await createAuditLog({
      actorId: payload.userId,
      action: 'tenant.delete',
      targetType: 'Tenant',
      targetId: id,
      metadata: { name: existing.name, slug: existing.slug },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Tenant deleted successfully'));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
