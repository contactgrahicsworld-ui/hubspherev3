import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const patchSecuritySchema = z.object({
  passwordPolicy: z.object({
    minLength: z.number().int().min(6).max(128).optional(),
    requireUppercase: z.boolean().optional(),
    requireNumbers: z.boolean().optional(),
    requireSpecialChars: z.boolean().optional(),
  }).optional(),
  sessionManagement: z.object({
    sessionTimeout: z.number().int().min(1).max(1440).optional(),
    maxConcurrentSessions: z.number().int().min(1).max(20).optional(),
  }).optional(),
  twoFactor: z.object({
    enforceForAdmins: z.boolean().optional(),
  }).optional(),
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
      select: { id: true, settings: true },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const settings = (tenant.settings as Record<string, unknown>) ?? {};
    const security = (settings.security as Record<string, unknown>) ?? {};
    const passwordPolicy = (security.passwordPolicy as Record<string, unknown>) ?? {};
    const sessionMgmt = (security.sessionManagement as Record<string, unknown>) ?? {};
    const twoFactor = (security.twoFactor as Record<string, unknown>) ?? {};

    // Get existing API keys (from settings JSON since no dedicated model)
    const apiKeys = ((security.apiKeys as Array<Record<string, unknown>>) ?? []).map((k) => ({
      id: k.id,
      name: k.name,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt ?? null,
      prefix: k.prefix ?? 'hs_••••',
    }));

    return NextResponse.json(
      success({
        passwordPolicy: {
          minLength: (passwordPolicy.minLength as number) ?? 8,
          requireUppercase: (passwordPolicy.requireUppercase as boolean) ?? true,
          requireNumbers: (passwordPolicy.requireNumbers as boolean) ?? true,
          requireSpecialChars: (passwordPolicy.requireSpecialChars as boolean) ?? false,
        },
        sessionManagement: {
          sessionTimeout: (sessionMgmt.sessionTimeout as number) ?? 30,
          maxConcurrentSessions: (sessionMgmt.maxConcurrentSessions as number) ?? 5,
        },
        twoFactor: {
          enforceForAdmins: (twoFactor.enforceForAdmins as boolean) ?? false,
        },
        apiKeys,
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

    await requirePermission(payload.roleCode ?? null, 'settings.edit', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = patchSecuritySchema.parse(body);

    const tenant = await db.tenant.findUnique({
      where: { id: payload.tenantId },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const currentSettings = (tenant.settings as Record<string, unknown>) ?? {};
    const currentSecurity = (currentSettings.security as Record<string, unknown>) ?? {};

    const updatedSecurity = { ...currentSecurity };

    if (data.passwordPolicy) {
      updatedSecurity.passwordPolicy = {
        ...((currentSecurity.passwordPolicy as Record<string, unknown>) ?? {}),
        ...data.passwordPolicy,
      };
    }
    if (data.sessionManagement) {
      updatedSecurity.sessionManagement = {
        ...((currentSecurity.sessionManagement as Record<string, unknown>) ?? {}),
        ...data.sessionManagement,
      };
    }
    if (data.twoFactor) {
      updatedSecurity.twoFactor = {
        ...((currentSecurity.twoFactor as Record<string, unknown>) ?? {}),
        ...data.twoFactor,
      };
    }

    await db.tenant.update({
      where: { id: payload.tenantId },
      data: {
        settings: JSON.parse(JSON.stringify({
          ...currentSettings,
          security: updatedSecurity,
        })),
      },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'admin.security.update',
      targetType: 'Tenant',
      targetId: payload.tenantId,
      metadata: { updatedSections: Object.keys(data) },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success({ updatedSections: Object.keys(data) }, 'Security settings updated successfully')
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
