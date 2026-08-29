import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission, getUserPermissions } from '@/lib/rbac';
import { listAgents } from '@/lib/ai';
import { aiGateway } from '@/lib/providers/ai-gateway';

// ============================================
// HELPERS
// ============================================

function isDbError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))
  );
}

function dbUnavailableResponse() {
  return NextResponse.json(
    { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
    { status: 503 },
  );
}

// ============================================
// GET /api/v1/ai/agents — List available AI agents
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'ai.view', payload.tenantId);

    const tenantId = payload.tenantId;
    const roleCode = payload.roleCode ?? null;

    // Get user permissions to determine which agents are available
    const userPermissions = await getUserPermissions(roleCode, tenantId);

    // Check if AI provider is configured
    const aiAvailable = aiGateway.isAvailable();

    // List all agents from the registry
    const agents = listAgents();

    // Enrich each agent with availability info
    const enrichedAgents = agents.map((agent) => {
      const hasPermissions = agent.requiredPermissions.every((p) =>
        userPermissions.includes(p),
      );

      // Available if: AI provider is configured AND user has all required permissions
      const available = aiAvailable && hasPermissions;

      return {
        name: agent.name,
        description: agent.description,
        requiredPermissions: agent.requiredPermissions,
        available,
        aiProviderConfigured: aiAvailable,
        hasPermissions,
      };
    });

    return NextResponse.json(
      success({
        agents: enrichedAgents,
        aiProviderConfigured: aiAvailable,
      }),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
