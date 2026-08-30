import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const updateSettingsSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  domain: z.string().trim().max(255).url().optional().nullable(),
  logoUrl: z.string().trim().max(1000).url().optional().nullable(),
  settings: z.record(z.string().max(100), z.unknown()).optional()
});

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'settings.view', payload.tenantId, payload.isSuperAdmin);

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
        settings: (tenant.settings as Record<string, unknown>) ?? {},
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

    await requirePermission(payload.roleCode ?? null, 'settings.edit', payload.tenantId, payload.isSuperAdmin);

    const tenant = await db.tenant.findUnique({
      where: { id: payload.tenantId },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const body = await request.json();
    const data = updateSettingsSchema.parse(body);

    const updateData: Record<string, unknown> = {};

    // Allow updating specific fields (only validated ones)
    if (data.name !== undefined) updateData.name = data.name;
    if (data.domain !== undefined) updateData.domain = data.domain;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.settings !== undefined) updateData.settings = data.settings;

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
        settings: (updated.settings as Record<string, unknown>) ?? {},
      }, 'Settings updated successfully')
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
