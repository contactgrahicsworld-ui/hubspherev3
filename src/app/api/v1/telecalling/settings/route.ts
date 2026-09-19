import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const patchTelecallingSchema = z.object({
  defaultExpiry: z.number().int().min(60).max(3600).optional(),
  heartbeatTimeout: z.number().int().min(1).max(30).optional(),
  maxConcurrentCalls: z.number().int().min(1).max(10).optional(),
  autoApprove: z.boolean().optional(),
  pairingExpiry: z.number().int().min(1).max(60).optional(),
  notifyRevoke: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'telecalling.manage', payload.tenantId, payload.isSuperAdmin);

    const tenant = await db.tenant.findUnique({
      where: { id: payload.tenantId },
      select: { id: true, settings: true },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const settings = (tenant.settings as Record<string, unknown>) ?? {};
    const telecalling = (settings.telecalling as Record<string, unknown>) ?? {};

    return NextResponse.json(
      success({
        defaultExpiry: (telecalling.defaultExpiry as number) ?? 300,
        heartbeatTimeout: (telecalling.heartbeatTimeout as number) ?? 5,
        maxConcurrentCalls: (telecalling.maxConcurrentCalls as number) ?? 1,
        autoApprove: (telecalling.autoApprove as boolean) ?? false,
        pairingExpiry: (telecalling.pairingExpiry as number) ?? 15,
        notifyRevoke: (telecalling.notifyRevoke as boolean) ?? true,
      })
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'telecalling.manage', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = patchTelecallingSchema.parse(body);

    const tenant = await db.tenant.findUnique({
      where: { id: payload.tenantId },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const currentSettings = (tenant.settings as Record<string, unknown>) ?? {};
    const currentTelecalling = (currentSettings.telecalling as Record<string, unknown>) ?? {};

    const updatedTelecalling = { ...currentTelecalling, ...data };

    await db.tenant.update({
      where: { id: payload.tenantId },
      data: {
        settings: {
          ...currentSettings,
          telecalling: updatedTelecalling,
        },
      },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'telecalling.settings.update',
      targetType: 'Tenant',
      targetId: payload.tenantId,
      metadata: { updatedFields: Object.keys(data) },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(updatedTelecalling, 'Telecalling settings saved')
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
