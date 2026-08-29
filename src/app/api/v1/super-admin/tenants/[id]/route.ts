import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { handleApiError, AuthorizationError, NotFoundError, ValidationError } from '@/lib/errors';
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
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        logoUrl: true,
        status: true,
        plan: true,
        maxUsers: true,
        _count: { select: { memberships: true, roles: true } },
        featureFlags: {
          include: { featureFlag: true },
        },
        createdAt: true,
        updatedAt: true,
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
        // settings excluded from response — may contain sensitive config
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

const updateTenantSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  domain: z.string().trim().max(255).optional().nullable(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'TRIAL', 'PAST_DUE']).optional(),
  plan: z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']).optional(),
  maxUsers: z.number().int().min(1).max(10000).optional(),
});

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

    if (!z.string().uuid().safeParse(id).success) {
      throw new ValidationError('Invalid tenant ID format');
    }

    const existing = await db.tenant.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Tenant not found');
    }

    const body = await request.json();
    const data = updateTenantSchema.parse(body);

    const tenant = await db.tenant.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.domain !== undefined && { domain: data.domain }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.plan !== undefined && { plan: data.plan }),
        ...(data.maxUsers !== undefined && { maxUsers: data.maxUsers }),
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

    if (!z.string().uuid().safeParse(id).success) {
      throw new ValidationError('Invalid tenant ID format');
    }

    const existing = await db.tenant.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Tenant not found');
    }

    // Soft-delete: set status to SUSPENDED instead of hard delete
    // Hard delete would cascade-destroy all tenant data irreversibly
    await db.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });

    await createAuditLog({
      actorId: payload.userId,
      action: 'tenant.delete',
      targetType: 'Tenant',
      targetId: id,
      metadata: { name: existing.name, slug: existing.slug },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Tenant suspended (soft-deleted) successfully'));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
