/**
 * Super Admin AI Configuration API
 *
 * GET  — Returns all provider configs + AI usage stats + tenant AI feature toggles
 * PATCH — Updates provider config (API key, model, priority, enabled) or tenant AI toggle
 *         Only SUPER_ADMIN can access this endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { handleApiError, AuthenticationError, AuthorizationError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { providerRegistry } from '@/lib/providers/provider-bootstrap';
import { z } from 'zod';

// ============================================
// HELPERS
// ============================================

/**
 * Simple base64 encoding for API key storage.
 * NOTE: In production, use proper encryption (e.g., AES-256-GCM with a KMS-managed key).
 */
function encryptApiKey(plain: string): string {
  return Buffer.from(plain).toString('base64');
}

function decryptApiKey(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

/**
 * Verify the requesting user is a Super Admin.
 */
async function requireSuperAdmin(request: NextRequest) {
  const payload = await getAuthUser(request);
  if (!payload.isSuperAdmin) {
    throw new AuthorizationError('Super Admin access required');
  }
  return payload;
}

// ============================================
// SCHEMAS
// ============================================

const patchProviderSchema = z.object({
  providerId: z.string().optional(),
  apiKey: z.string().min(1).optional(),
  defaultModel: z.string().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  enabled: z.boolean().optional(),
  // Tenant AI toggle
  tenantId: z.string().uuid().optional(),
  aiEnabled: z.boolean().optional(),
});

// ============================================
// GET — Fetch all AI config data
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await requireSuperAdmin(request);

    const { searchParams } = new URL(request.url);
    const testProvider = searchParams.get('test');

    // ---- Health check for a specific provider ----
    if (testProvider) {
      const provider = providerRegistry.getProvider('AIProvider');
      if (!provider) {
        throw new ValidationError(`Provider not found: ${testProvider}`);
      }
      let healthy = false;
      try {
        healthy = await provider.healthCheck();
      } catch {
        healthy = false;
      }
      // Update the healthy status in DB
      try {
        await db.providerConfig.update({
          where: { providerId: testProvider },
          data: { healthy },
        });
      } catch {
        // best-effort DB update
      }
      return NextResponse.json(success({ healthy }, 'Health check complete'));
    }

    // ---- Fetch provider configs from DB ----
    const providers = await db.providerConfig.findMany({
      where: { category: 'AIProvider' },
      orderBy: { priority: 'desc' },
      select: {
        providerId: true,
        name: true,
        category: true,
        enabled: true,
        configured: true,
        healthy: true,
        priority: true,
        config: true,
      },
    });

    // Check if API key is set for each provider (without exposing it)
    const providerData = providers.map((p) => {
      const config = (p.config as Record<string, unknown>) ?? {};
      return {
        providerId: p.providerId,
        name: p.name,
        category: p.category,
        enabled: p.enabled,
        configured: p.configured,
        healthy: p.healthy,
        priority: p.priority,
        defaultModel: (config.defaultModel as string) ?? undefined,
        apiKeySet: !!(config.encryptedApiKey as string),
      };
    });

    // ---- Fetch usage stats ----
    // Aggregate from AIUsageLog if the table exists
    let usage = {
      totalTokens: 0,
      totalCost: 0,
      callsPerDay: 0,
      byProvider: {} as Record<string, { tokens: number; cost: number; calls: number }>,
    };

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Total tokens and cost in the last 30 days
      const aggregateResult = await db.aiUsageLog.aggregate({
        _sum: { inputTokens: true, outputTokens: true },
        _count: true,
        where: { createdAt: { gte: thirtyDaysAgo } },
      });

      // Calls today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const callsToday = await db.aiUsageLog.count({
        where: { createdAt: { gte: todayStart } },
      });

      // Per-provider breakdown
      const byProviderRaw = await db.aiUsageLog.groupBy({
        by: ['providerId'],
        _sum: { inputTokens: true, outputTokens: true },
        _count: true,
        where: { createdAt: { gte: thirtyDaysAgo } },
      });

      const byProvider: Record<string, { tokens: number; cost: number; calls: number }> = {};
      for (const row of byProviderRaw) {
        byProvider[row.providerId ?? 'unknown'] = {
          tokens: (row._sum?.inputTokens ?? 0) + (row._sum?.outputTokens ?? 0),
          cost: 0,
          calls: row._count,
        };
      }

      usage = {
        totalTokens: (aggregateResult._sum?.inputTokens ?? 0) + (aggregateResult._sum?.outputTokens ?? 0),
        totalCost: 0,
        callsPerDay: callsToday,
        byProvider,
      };
    } catch {
      // AIUsageLog table may not exist yet — return zeros
    }

    // ---- Fetch tenant AI feature toggles ----
    let tenantFeatures: Array<{ tenantId: string; tenantName: string; aiEnabled: boolean }> = [];
    try {
      const tenants = await db.tenant.findMany({
        select: {
          id: true,
          name: true,
          settings: true,
        },
      });
      tenantFeatures = tenants.map((t) => ({
        tenantId: t.id,
        tenantName: t.name,
        aiEnabled: (t.settings as Record<string, unknown>)?.aiEnabled === true,
      }));
    } catch {
      // tenants may not have featureFlags column yet
    }

    return NextResponse.json(
      success({ providers: providerData, usage, tenantFeatures }, 'AI configuration loaded'),
    );
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// PATCH — Update provider config or tenant AI toggle
// ============================================

export async function PATCH(request: NextRequest) {
  try {
    const payload = await requireSuperAdmin(request);
    const body = await request.json();
    const data = validate(patchProviderSchema, body);

    // ---- Tenant AI toggle ----
    if (data.tenantId && data.aiEnabled !== undefined) {
      const tenant = await db.tenant.findUnique({
        where: { id: data.tenantId },
        select: { id: true, settings: true },
      });

      if (!tenant) {
        throw new ValidationError('Tenant not found');
      }

      const existingSettings = (tenant.settings as Record<string, unknown>) ?? {};
      await db.tenant.update({
        where: { id: data.tenantId },
        data: {
          settings: { ...existingSettings, aiEnabled: data.aiEnabled },
        },
      });

      await createAuditLog({
        actorId: payload.userId,
        action: 'ai-config.tenant_toggle',
        targetType: 'Tenant',
        targetId: data.tenantId,
        metadata: { aiEnabled: data.aiEnabled },
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });

      return NextResponse.json(success(null, 'Tenant AI feature updated'));
    }

    // ---- Provider config update ----
    if (!data.providerId) {
      throw new ValidationError('providerId is required');
    }

    const existing = await db.providerConfig.findUnique({
      where: { providerId: data.providerId },
    });

    if (!existing) {
      throw new ValidationError(`Provider not found: ${data.providerId}`);
    }

    const existingConfig = (existing.config as Record<string, unknown>) ?? {};
    const configUpdates: Record<string, unknown> = { ...existingConfig };

    // Update API key (encrypt before storing)
    if (data.apiKey) {
      configUpdates.encryptedApiKey = encryptApiKey(data.apiKey);
      configUpdates.apiKeySet = true;
    }

    // Update default model
    if (data.defaultModel !== undefined) {
      configUpdates.defaultModel = data.defaultModel;
    }

    // Build the DB update
    const dbUpdate: Record<string, unknown> = {
      config: configUpdates,
    };

    if (data.priority !== undefined) {
      dbUpdate.priority = data.priority;
    }

    if (data.enabled !== undefined) {
      dbUpdate.enabled = data.enabled;
    }

    await db.providerConfig.update({
      where: { providerId: data.providerId },
      data: dbUpdate,
    });

    // If API key was provided, also update the env-like config so provider
    // can be re-registered with the new key on next bootstrap.
    // For now, the key is stored encrypted in the config JSON column.

    await createAuditLog({
      actorId: payload.userId,
      action: 'ai-config.provider_update',
      targetType: 'ProviderConfig',
      targetId: data.providerId,
      metadata: {
        priority: data.priority,
        enabled: data.enabled,
        defaultModel: data.defaultModel,
        apiKeyUpdated: !!data.apiKey,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Provider configuration updated'));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// VALIDATE HELPER
// ============================================

function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstError = result.error.issues[0];
    throw new ValidationError(
      firstError?.message ?? 'Validation failed',
    );
  }
  return result.data;
}
