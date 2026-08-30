import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { requirePermission } from '@/lib/rbac';
import { providerRegistry } from '@/lib/providers/registry';
import { db } from '@/lib/db';
import { aiGateway } from '@/lib/providers/ai-gateway';

// ============================================
// GET /api/v1/ai/providers — AI provider status
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'ai.view', payload.tenantId, payload.isSuperAdmin);

    // Get all AI provider info from the registry
    const registryProviders = providerRegistry.getProvidersByCategory('AIProvider');

    // Get AI provider configs from DB
    const dbProviders = await db.providerConfig.findMany({
      where: { category: 'AIProvider' },
      orderBy: { priority: 'desc' },
    });

    // Determine overall gateway status
    const gatewayStatus = aiGateway.getStatus();

    // Combine registry status with DB status
    const providers = dbProviders.map((p) => {
      const registered = registryProviders.find(
        (rp) => rp.providerId === p.providerId
      );

      let effectiveStatus: string;
      if (registered) {
        effectiveStatus = registered.status;
      } else if (p.configured && p.healthy === true) {
        effectiveStatus = 'HEALTHY';
      } else if (p.configured) {
        effectiveStatus = 'CONFIGURED';
      } else {
        effectiveStatus = 'NOT_CONFIGURED';
      }

      return {
        providerId: p.providerId,
        name: p.name,
        status: effectiveStatus,
        enabled: p.enabled,
        configured: p.configured,
        healthy: p.healthy,
        priority: p.priority,
        lastCheckAt: p.lastCheckAt,
      };
    });

    return NextResponse.json(
      success({
        available: gatewayStatus.available,
        activeProvider: gatewayStatus.provider,
        reason: gatewayStatus.reason,
        providers,
      })
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
