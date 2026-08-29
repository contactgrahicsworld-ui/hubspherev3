import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
} from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

// ============================================
// HELPERS
// ============================================

const providerSelect = {
  id: true,
  tenantId: true,
  channel: true,
  provider: true,
  config: true,
  isEnabled: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const;

function maskConfig(config: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  const sensitivePatterns = /api[_-]?key|token|secret|password|auth|credential|private[_-]?key|access[_-]?key/i;

  for (const [key, value] of Object.entries(config)) {
    if (sensitivePatterns.test(key) && typeof value === 'string' && value.length > 0) {
      masked[key] = '***MASKED***';
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

function formatProvider(p: any) {
  return {
    id: p.id,
    channel: p.channel,
    provider: p.provider,
    config: maskConfig(p.config as Record<string, unknown> ?? {}),
    isEnabled: p.isEnabled,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// ============================================
// GET /api/v1/communication/providers/:id
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'communication_settings.view', payload.tenantId);

    const { id } = await params;

    const providerConfig = await db.communicationProviderConfig.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: providerSelect,
    });

    if (!providerConfig) {
      throw new NotFoundError('Provider config not found');
    }

    return NextResponse.json(success(formatProvider(providerConfig as any)));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))
    ) {
      return NextResponse.json(
        { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 },
      );
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// DELETE /api/v1/communication/providers/:id
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'communication_settings.manage', payload.tenantId);

    const { id } = await params;

    const existing = await db.communicationProviderConfig.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: { id: true, channel: true, provider: true },
    });

    if (!existing) {
      throw new NotFoundError('Provider config not found');
    }

    await db.communicationProviderConfig.delete({
      where: { id },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'provider_config.delete',
      targetType: 'CommunicationProviderConfig',
      targetId: id,
      metadata: { channel: existing.channel, provider: existing.provider },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Provider config deleted successfully'));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))
    ) {
      return NextResponse.json(
        { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 },
      );
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
