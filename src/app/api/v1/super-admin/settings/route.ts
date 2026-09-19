import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthorizationError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const patchSettingsSchema = z.object({
  general: z.object({
    tenantName: z.string().trim().min(1).max(255).optional(),
    domain: z.string().trim().max(255).optional().nullable(),
    logoUrl: z.string().trim().max(1000).optional().nullable(),
  }).optional(),
  security: z.object({
    sessionTimeout: z.number().int().min(1).max(1440).optional(),
    passwordMinLength: z.number().int().min(6).max(128).optional(),
    enforce2FA: z.boolean().optional(),
  }).optional(),
  email: z.object({
    provider: z.enum(['resend', 'sendgrid', 'smtp']).optional(),
    fromEmail: z.string().trim().max(255).optional(),
    apiKey: z.string().trim().max(500).optional(),
  }).optional(),
  storage: z.object({
    provider: z.enum(['supabase', 'aws-s3']).optional(),
    bucketName: z.string().trim().max(255).optional(),
    region: z.string().trim().max(100).optional(),
  }).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.isSuperAdmin) {
      throw new AuthorizationError('Super admin access required');
    }

    // Get the first tenant as the platform tenant for system-wide settings
    const tenant = await db.tenant.findFirst({
      where: { id: payload.tenantId ?? undefined },
      select: {
        id: true,
        name: true,
        domain: true,
        logoUrl: true,
        settings: true,
      },
    });

    const settings = (tenant?.settings as Record<string, unknown>) ?? {};
    const general = (settings.general as Record<string, unknown>) ?? {};
    const security = (settings.security as Record<string, unknown>) ?? {};
    const email = (settings.email as Record<string, unknown>) ?? {};
    const storage = (settings.storage as Record<string, unknown>) ?? {};

    return NextResponse.json(
      success({
        general: {
          tenantName: tenant?.name ?? '',
          domain: tenant?.domain ?? '',
          logoUrl: tenant?.logoUrl ?? '',
        },
        security: {
          sessionTimeout: (security.sessionTimeout as number) ?? 30,
          passwordMinLength: (security.passwordMinLength as number) ?? 8,
          enforce2FA: (security.enforce2FA as boolean) ?? false,
        },
        email: {
          provider: (email.provider as string) ?? 'resend',
          fromEmail: (email.fromEmail as string) ?? '',
          apiKeyConfigured: !!email.apiKey,
        },
        storage: {
          provider: (storage.provider as string) ?? 'supabase',
          bucketName: (storage.bucketName as string) ?? '',
          region: (storage.region as string) ?? '',
        },
        env: {
          resendConfigured: !!process.env.RESEND_API_KEY,
          sendgridConfigured: !!process.env.SENDGRID_API_KEY,
          smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_PORT),
          supabaseConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          awsConfigured: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
        },
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

    if (!payload.isSuperAdmin) {
      throw new AuthorizationError('Super admin access required');
    }

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    const body = await request.json();
    const data = patchSettingsSchema.parse(body);

    const tenant = await db.tenant.findUnique({
      where: { id: payload.tenantId },
    });

    if (!tenant) {
      throw new AuthenticationError('Tenant not found');
    }

    const currentSettings = (tenant.settings as Record<string, unknown>) ?? {};
    const updatedSettings = { ...currentSettings };

    // Merge each section
    if (data.general) {
      updatedSettings.general = {
        ...((currentSettings.general as Record<string, unknown>) ?? {}),
        ...data.general,
      };
    }
    if (data.security) {
      updatedSettings.security = {
        ...((currentSettings.security as Record<string, unknown>) ?? {}),
        ...data.security,
      };
    }
    if (data.email) {
      updatedSettings.email = {
        ...((currentSettings.email as Record<string, unknown>) ?? {}),
        ...data.email,
      };
    }
    if (data.storage) {
      updatedSettings.storage = {
        ...((currentSettings.storage as Record<string, unknown>) ?? {}),
        ...data.storage,
      };
    }

    // Update top-level tenant fields from general settings
    const tenantUpdate: Record<string, unknown> = { settings: updatedSettings };
    if (data.general?.tenantName !== undefined) tenantUpdate.name = data.general.tenantName;
    if (data.general?.domain !== undefined) tenantUpdate.domain = data.general.domain;
    if (data.general?.logoUrl !== undefined) tenantUpdate.logoUrl = data.general.logoUrl;

    const updated = await db.tenant.update({
      where: { id: payload.tenantId },
      data: tenantUpdate,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'super_admin.settings.update',
      targetType: 'Tenant',
      targetId: payload.tenantId,
      metadata: { updatedSections: Object.keys(data) },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    const newSettings = (updated.settings as Record<string, unknown>) ?? {};
    const newGeneral = (newSettings.general as Record<string, unknown>) ?? {};
    const newSecurity = (newSettings.security as Record<string, unknown>) ?? {};
    const newEmail = (newSettings.email as Record<string, unknown>) ?? {};
    const newStorage = (newSettings.storage as Record<string, unknown>) ?? {};

    return NextResponse.json(
      success({
        general: {
          tenantName: updated.name,
          domain: updated.domain,
          logoUrl: updated.logoUrl,
        },
        security: {
          sessionTimeout: (newSecurity.sessionTimeout as number) ?? 30,
          passwordMinLength: (newSecurity.passwordMinLength as number) ?? 8,
          enforce2FA: (newSecurity.enforce2FA as boolean) ?? false,
        },
        email: {
          provider: (newEmail.provider as string) ?? 'resend',
          fromEmail: (newEmail.fromEmail as string) ?? '',
          apiKeyConfigured: !!newEmail.apiKey,
        },
        storage: {
          provider: (newStorage.provider as string) ?? 'supabase',
          bucketName: (newStorage.bucketName as string) ?? '',
          region: (newStorage.region as string) ?? '',
        },
      }, 'Settings updated successfully')
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
