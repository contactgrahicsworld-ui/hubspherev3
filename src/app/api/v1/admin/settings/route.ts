import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'settings.view', payload.tenantId);

    const tenant = await db.tenant.findUnique({
      where: { id: payload.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        logoUrl: true,
        status: true,
        plan: true,
        maxUsers: true,
        settings: true,
      },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    return NextResponse.json(
      success({
        ...tenant,
        settings: tenant.settings ? JSON.parse(tenant.settings) : {},
      })
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'settings.edit', payload.tenantId);

    const tenant = await db.tenant.findUnique({
      where: { id: payload.tenantId },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const body = await request.json();

    const updateData: Record<string, unknown> = {};

    // Allow updating specific fields
    if (body.name !== undefined) updateData.name = body.name;
    if (body.domain !== undefined) updateData.domain = body.domain;
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl;
    if (body.settings !== undefined) {
      updateData.settings = JSON.stringify(body.settings);
    }

    const updated = await db.tenant.update({
      where: { id: payload.tenantId },
      data: updateData,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'settings.update',
      targetType: 'Tenant',
      targetId: payload.tenantId,
      metadata: { updatedFields: Object.keys(updateData) },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success({
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        domain: updated.domain,
        logoUrl: updated.logoUrl,
        status: updated.status,
        plan: updated.plan,
        maxUsers: updated.maxUsers,
        settings: updated.settings ? JSON.parse(updated.settings) : {},
      }, 'Settings updated successfully')
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
