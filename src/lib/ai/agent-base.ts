/**
 * Base class for all AI agents.
 * Enforces RBAC, tenant isolation, audit logging, rate limits.
 * NEVER fabricates AI output.
 */

import { db } from '@/lib/db';
import { aiGateway } from '@/lib/providers/ai-gateway';
import { ProviderNotConfiguredError, AuthorizationError, ValidationError } from '@/lib/errors';

// ============================================
// TYPES
// ============================================

export interface AgentResponse {
  content: string;
  source: 'AI_SUGGESTION' | 'AI_ANALYSIS' | 'AI_SUMMARY';
  confidence?: number;
  data?: Record<string, unknown>;
}

export interface AgentExecuteParams {
  prompt: string;
  tenantId: string;
  userId: string;
  userPermissions: string[];
  context?: Record<string, unknown>;
}

export interface AgentUsageLogParams {
  tenantId: string;
  userId: string;
  agentName: string;
  promptTokens?: number;
  completionTokens?: number;
  model?: string;
  providerId?: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

// ============================================
// BASE AGENT
// ============================================

export abstract class AgentBase {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly requiredPermissions: string[];

  /**
   * Check if the user has the required permissions to use this agent.
   */
  canExecute(userPermissions: string[]): boolean {
    // Super admin or users with ai.manage have access to all agents
    if (userPermissions.includes('ai.manage') || userPermissions.includes('ai.*')) {
      return true;
    }

    return this.requiredPermissions.every((required) =>
      userPermissions.includes(required)
    );
  }

  /**
   * Validate that a tenant ID is provided. Throws if missing.
   */
  validateTenant(tenantId: string | undefined): asserts tenantId is string {
    if (!tenantId) {
      throw new ValidationError('Tenant ID is required');
    }
  }

  /**
   * Log AI usage to the AiUsageLog table.
   */
  protected async logUsage(params: AgentUsageLogParams): Promise<void> {
    try {
      await db.aiUsageLog.create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
          providerId: params.providerId,
          model: params.model,
          agentName: params.agentName,
          inputTokens: params.promptTokens,
          outputTokens: params.completionTokens,
          durationMs: params.durationMs,
          status: params.success ? 'SUCCESS' : 'FAILED',
        },
      });
    } catch {
      // Usage logging is best-effort — never block the response
    }
  }

  /**
   * Execute the agent with the given prompt.
   * Subclasses must implement this method with their specific logic.
   */
  abstract execute(params: AgentExecuteParams): Promise<AgentResponse>;

  /**
   * Helper for subclasses to call the AI gateway with error handling.
   * Returns null if provider is not configured (caller decides the fallback).
   */
  protected async callAI(
    prompt: string,
    tenantId: string,
    options?: Record<string, unknown>
  ): Promise<
    | { content: string; model: string; providerId: string; inputTokens: number; outputTokens: number }
    | null
  > {
    try {
      const response = await aiGateway.process(prompt, tenantId, options);
      return {
        content: response.content,
        model: response.model,
        providerId: response.providerId,
        inputTokens: response.usage?.inputTokens ?? 0,
        outputTokens: response.usage?.outputTokens ?? 0,
      };
    } catch (err) {
      if (err instanceof ProviderNotConfiguredError) {
        return null;
      }
      throw err;
    }
  }
}
