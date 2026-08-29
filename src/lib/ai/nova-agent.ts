/**
 * NOVA — HubSphere's AI Business Copilot.
 * General-purpose assistant for CRM, HRMS, and business questions.
 */

import { AgentBase, type AgentExecuteParams, type AgentResponse } from './agent-base';
import { AuthorizationError } from '@/lib/errors';

const SYSTEM_PROMPT =
  'You are NOVA, HubSphere\'s AI business copilot. You help users with CRM, HRMS, and business questions. Always respect data boundaries. Mark suggestions clearly.';

class NovaAgent extends AgentBase {
  readonly name = 'NOVA';
  readonly description = 'HubSphere AI business copilot — CRM, HRMS, and general business assistance';
  readonly requiredPermissions = ['leads.view', 'contacts.view'];

  async execute(params: AgentExecuteParams): Promise<AgentResponse> {
    const startTime = Date.now();

    // 1. Validate permissions
    if (!this.canExecute(params.userPermissions)) {
      throw new AuthorizationError(
        `Agent NOVA requires permissions: ${this.requiredPermissions.join(', ')}`
      );
    }

    // 2. Validate tenant
    this.validateTenant(params.tenantId);

    // 3. Build the full prompt with system context and any user-provided context
    const contextBlock = params.context
      ? `\n\nAdditional context:\n${JSON.stringify(params.context, null, 2)}`
      : '';

    const fullPrompt = `${SYSTEM_PROMPT}${contextBlock}\n\nUser question: ${params.prompt}`;

    // 4. Call AI gateway
    const result = await this.callAI(fullPrompt, params.tenantId);

    // 5. Handle provider not configured
    if (!result) {
      return {
        content:
          'AI_NOT_CONFIGURED: No AI provider is configured. Please configure an AI provider in Settings > Providers.',
        source: 'AI_SUGGESTION',
      };
    }

    // 6. Log usage
    const durationMs = Date.now() - startTime;
    await this.logUsage({
      tenantId: params.tenantId,
      userId: params.userId,
      agentName: this.name,
      promptTokens: result.inputTokens,
      completionTokens: result.outputTokens,
      model: result.model,
      providerId: result.providerId,
      durationMs,
      success: true,
    });

    // 7. Return response
    return {
      content: result.content,
      source: 'AI_SUGGESTION',
    };
  }
}

export const novaAgent = new NovaAgent();
