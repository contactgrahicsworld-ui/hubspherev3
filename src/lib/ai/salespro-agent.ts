/**
 * SALESPRO — HubSphere Sales Intelligence.
 * Lead scoring, deal risk analysis, next-best-action, sales messaging.
 */

import { AgentBase, type AgentExecuteParams, type AgentResponse } from './agent-base';
import { AuthorizationError } from '@/lib/errors';

class SalesProAgent extends AgentBase {
  readonly name = 'SALESPRO';
  readonly description = 'HubSphere sales intelligence — lead scoring, deal risk analysis, next-best-action, and sales messaging';
  readonly requiredPermissions = ['leads.view', 'deals.view'];

  async execute(params: AgentExecuteParams): Promise<AgentResponse> {
    // SALESPRO execute handles general sales questions
    const startTime = Date.now();

    if (!this.canExecute(params.userPermissions)) {
      throw new AuthorizationError(
        `Agent SALESPRO requires permissions: ${this.requiredPermissions.join(', ')}`
      );
    }

    this.validateTenant(params.tenantId);

    const systemPrompt =
      'You are SALESPRO, HubSphere\'s AI sales intelligence assistant. You help users with lead scoring, deal analysis, sales strategies, and messaging. Mark suggestions clearly.';

    const contextBlock = params.context
      ? `\n\nAdditional context:\n${JSON.stringify(params.context, null, 2)}`
      : '';

    const fullPrompt = `${systemPrompt}${contextBlock}\n\nUser question: ${params.prompt}`;
    const result = await this.callAI(fullPrompt, params.tenantId);

    if (!result) {
      return {
        content:
          'AI_NOT_CONFIGURED: No AI provider is configured. Please configure an AI provider in Settings > Providers.',
        source: 'AI_SUGGESTION',
      };
    }

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

    return { content: result.content, source: 'AI_SUGGESTION' };
  }

  /**
   * AI-powered lead scoring.
   */
  async scoreLead(
    leadData: Record<string, unknown>,
    tenantId: string
  ): Promise<AgentResponse> {
    this.validateTenant(tenantId);

    const prompt = `You are a sales expert. Score the following lead on a scale of 0-100 based on fit, engagement signals, and likelihood to convert. Provide a numerical score and a brief justification.

Lead data:
${JSON.stringify(leadData, null, 2)}`;

    const result = await this.callAI(prompt, tenantId);

    if (!result) {
      return {
        content:
          'AI_NOT_CONFIGURED: No AI provider is configured. Please configure an AI provider in Settings > Providers.',
        source: 'AI_SUGGESTION',
      };
    }

    return { content: result.content, source: 'AI_ANALYSIS' };
  }

  /**
   * Deal risk analysis.
   */
  async analyzeDealRisk(
    dealData: Record<string, unknown>,
    tenantId: string
  ): Promise<AgentResponse> {
    this.validateTenant(tenantId);

    const prompt = `You are a sales expert. Analyze the following deal for risks. Identify potential blockers, competitive threats, timeline risks, and provide a risk level (LOW, MEDIUM, HIGH, CRITICAL) with explanation.

Deal data:
${JSON.stringify(dealData, null, 2)}`;

    const result = await this.callAI(prompt, tenantId);

    if (!result) {
      return {
        content:
          'AI_NOT_CONFIGURED: No AI provider is configured. Please configure an AI provider in Settings > Providers.',
        source: 'AI_SUGGESTION',
      };
    }

    return { content: result.content, source: 'AI_ANALYSIS' };
  }

  /**
   * Suggest the next best action for a lead/deal.
   */
  async suggestNextAction(
    leadData: Record<string, unknown>,
    dealData: Record<string, unknown> | undefined,
    tenantId: string
  ): Promise<AgentResponse> {
    this.validateTenant(tenantId);

    const dealBlock = dealData
      ? `\nDeal data:\n${JSON.stringify(dealData, null, 2)}`
      : '';

    const prompt = `You are a sales expert. Based on the following lead and deal data, suggest the single best next action the sales rep should take.

Lead data:
${JSON.stringify(leadData, null, 2)}${dealBlock}`;

    const result = await this.callAI(prompt, tenantId);

    if (!result) {
      return {
        content:
          'AI_NOT_CONFIGURED: No AI provider is configured. Please configure an AI provider in Settings > Providers.',
        source: 'AI_SUGGESTION',
      };
    }

    return { content: result.content, source: 'AI_SUGGESTION' };
  }

  /**
   * Generate a personalized sales message.
   */
  async generateSalesMessage(context: {
    leadName: string;
    company: string;
    product: string;
    tone?: string;
  }, tenantId: string): Promise<AgentResponse> {
    this.validateTenant(tenantId);

    const tone = context.tone ?? 'professional';

    const prompt = `Generate a ${tone} sales outreach message for the following:
- Lead name: ${context.leadName}
- Company: ${context.company}
- Product: ${context.product}

The message should be concise, personalized, and include a clear call-to-action.`;

    const result = await this.callAI(prompt, tenantId);

    if (!result) {
      return {
        content:
          'AI_NOT_CONFIGURED: No AI provider is configured. Please configure an AI provider in Settings > Providers.',
        source: 'AI_SUGGESTION',
      };
    }

    return { content: result.content, source: 'AI_SUGGESTION' };
  }

  /**
   * Objection handling assistance.
   */
  async handleObjection(
    objection: string,
    context: Record<string, unknown>,
    tenantId: string
  ): Promise<AgentResponse> {
    this.validateTenant(tenantId);

    const prompt = `You are a sales expert. Help handle the following customer objection with a professional, empathetic response.

Objection: ${objection}

Context: ${JSON.stringify(context, null, 2)}`;

    const result = await this.callAI(prompt, tenantId);

    if (!result) {
      return {
        content:
          'AI_NOT_CONFIGURED: No AI provider is configured. Please configure an AI provider in Settings > Providers.',
        source: 'AI_SUGGESTION',
      };
    }

    return { content: result.content, source: 'AI_SUGGESTION' };
  }
}

export const salesProAgent = new SalesProAgent();
