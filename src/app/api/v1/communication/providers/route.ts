import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  ValidationError,
} from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const createProviderSchema = z.object({
  channel: z.string().trim().min(1, 'Channel is required'),
  provider: z.string().trim().min(1, 'Provider name is required'),
  config: z.record(z.string(), z.unknown()).optional(),
  isEnabled: z.boolean().default(false),
  name: z.string().trim().optional(),
});

const updateProviderSchema = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
  isEnabled: z.boolean().optional(),
  name: z.string().trim().optional(),
});

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

/**
 * Mask sensitive values in provider config (API keys, tokens, secrets, passwords).
 * Replaces the value with '***MASKED***' while keeping the key visible.
 */
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

function formatProvider(p: any, mask = true) {
  return {
    id: p.id,
    channel: p.channel,
    provider: p.provider,
    config: mask ? maskConfig(p.config as Record<string, unknown> ?? {}) : p.config,
    isEnabled: p.isEnabled,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// ============================================
// GET /api/v1/communication/providers — List (masked)
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'communication_settings.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const channel = searchParams.get('channel');

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    if (channel) where.channel = channel;

    const [providers, total] = await Promise.all([
      db.communicationProviderConfig.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: providerSelect,
      }),
      db.communicationProviderConfig.count({ where }),
    ]);

    return NextResponse.json(paginated(providers.map((p) => formatProvider(p, true)), total, page, limit));
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
// POST /api/v1/communication/providers — Create
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'communication_settings.manage', payload.tenantId);

    const body = await request.json();
    const data = validate(createProviderSchema, body);

    const validChannels = ['WHATSAPP', 'EMAIL', 'SMS', 'PUSH'];
    if (!validChannels.includes(data.channel)) {
      throw new ValidationError(
        `Invalid channel. Must be one of: ${validChannels.join(', ')}`,
      );
    }

    // Check for duplicate (tenantId + channel + provider must be unique)
    const existing = await db.communicationProviderConfig.findFirst({
      where: {
        tenantId: payload.tenantId,
        channel: data.channel,
        provider: data.provider,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ValidationError(
        `Provider config for ${data.channel}/${data.provider} already exists`,
      );
    }

    const providerConfig = await db.communicationProviderConfig.create({
      data: {
        tenantId: payload.tenantId,
        channel: data.channel,
        provider: data.provider,
        config: (data.config ?? {}) as any,
        isEnabled: data.isEnabled,
        name: data.name ?? null,
      },
      select: providerSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'provider_config.create',
      targetType: 'CommunicationProviderConfig',
      targetId: providerConfig.id,
      metadata: {
        channel: data.channel,
        provider: data.provider,
        name: data.name,
        isEnabled: data.isEnabled,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(
        formatProvider(providerConfig as any, true),
        'Provider config created successfully',
      ),
      { status: 201 },
    );
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
// PATCH /api/v1/communication/providers — Update (by channel+provider)
// ============================================

export async function PATCH(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'communication_settings.manage', payload.tenantId);

    const body = await request.json();
    const data = validate(updateProviderSchema, body);

    // Must provide channel and provider to identify the config
    const channel = (body as Record<string, unknown>).channel as string | undefined;
    const provider = (body as Record<string, unknown>).provider as string | undefined;

    if (!channel || !provider) {
      throw new ValidationError('channel and provider are required to identify the config');
    }

    const existing = await db.communicationProviderConfig.findFirst({
      where: {
        tenantId: payload.tenantId,
        channel,
        provider,
      },
    });

    if (!existing) {
      throw new ValidationError(`Provider config for ${channel}/${provider} not found`);
    }

    const updateData: Record<string, unknown> = {};
    if (data.config !== undefined) updateData.config = data.config;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
    if (data.name !== undefined) updateData.name = data.name;

    const updated = await db.communicationProviderConfig.update({
      where: { id: existing.id },
      data: updateData,
      select: providerSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'provider_config.update',
      targetType: 'CommunicationProviderConfig',
      targetId: existing.id,
      metadata: { changes: Object.keys(updateData) },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(
        formatProvider(updated as any, true),
        'Provider config updated successfully',
      ),
    );
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
