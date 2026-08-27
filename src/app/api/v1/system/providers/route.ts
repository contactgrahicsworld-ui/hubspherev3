import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { providerRegistry } from '@/lib/providers/registry';
import { PROVIDER_CATEGORIES } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Super admin access required', code: 'AUTHORIZATION_ERROR' },
        { status: 403 }
      );
    }

    // Get all providers from the in-memory registry
    const registeredProviders = providerRegistry.getAllProviders();

    // Get providers from DB for a complete view
    const dbProviders = await db.providerConfig.findMany({
      orderBy: { category: 'asc' },
    });

    // Combine: DB providers with registry status
    const allProviders = dbProviders.map((p) => {
      const registered = registeredProviders.find(
        (rp) => rp.providerId === p.providerId
      );
      return {
        providerId: p.providerId,
        name: p.name,
        category: p.category,
        enabled: p.enabled,
        configured: p.configured,
        healthy: p.healthy,
        registered: !!registered,
        registryStatus: registered?.status ?? 'NOT_CONFIGURED',
        priority: p.priority,
        lastCheckAt: p.lastCheckAt,
      };
    });

    // Add categories that have no providers yet
    const categoriesWithProviders = new Set(allProviders.map((p) => p.category));
    for (const category of PROVIDER_CATEGORIES) {
      if (!categoriesWithProviders.has(category)) {
        allProviders.push({
          providerId: '',
          name: `No ${category} provider`,
          category,
          enabled: false,
          configured: false,
          healthy: null,
          registered: false,
          registryStatus: 'NOT_CONFIGURED',
          priority: 0,
          lastCheckAt: null,
        });
      }
    }

    return NextResponse.json(success(allProviders));
  } catch (error) {
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
