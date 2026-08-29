import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';
import { handleApiError, AuthenticationError, AuthorizationError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { requirePermission, getUserPermissions } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { getAgent, VALID_AGENT_NAMES } from '@/lib/ai';
import { z } from 'zod';

// ============================================
// SCHEMA
// ============================================

const chatRequestSchema = z.object({
  agent: z
    .string()
    .refine(
      (val) => VALID_AGENT_NAMES.includes(val.toUpperCase()),
      { message: `Agent must be one of: ${VALID_AGENT_NAMES.join(', ')}` }
    )
    .transform((val) => val.toUpperCase()),
  prompt: z.string().trim().min(1, 'Prompt is required').max(10000),
  context: z.record(z.string(), z.unknown()).optional(),
});

type ChatRequest = z.infer<typeof chatRequestSchema>;

// ============================================
// POST /api/v1/ai/chat
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    // Parse and validate body
    const body = await request.json();
    const { agent: agentName, prompt, context } = chatRequestSchema.parse(body) as ChatRequest;

    // Get the agent
    const agent = getAgent(agentName);
    if (!agent) {
      throw new ValidationError(`Unknown agent: ${agentName}`);
    }

    // Get user permissions for RBAC check
    const userPermissions = await getUserPermissions(
      payload.roleCode ?? null,
      payload.tenantId
    );

    // Check if user has required permissions
    if (!agent.canExecute(userPermissions)) {
      throw new AuthorizationError(
        `Insufficient permissions to use agent ${agentName}. Required: ${agent.requiredPermissions.join(', ')}`
      );
    }

    // Execute the agent
    const response = await agent.execute({
      prompt,
      tenantId: payload.tenantId,
      userId: payload.userId,
      userPermissions,
      context,
    });

    // Audit log
    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'ai.chat',
      targetType: 'AI',
      targetId: agentName,
      metadata: {
        agent: agentName,
        source: response.source,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(response));
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
