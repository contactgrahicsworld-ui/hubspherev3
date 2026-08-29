/**
 * INSIGHT — HubSphere Analytics Intelligence.
 * KPI explanation, trend detection, cross-module insights, anomaly detection.
 */

import { AgentBase, type AgentExecuteParams, type AgentResponse } from './agent-base';
import { db } from '@/lib/db';
import { AuthorizationError } from '@/lib/errors';

class InsightAgent extends AgentBase {
  readonly name = 'INSIGHT';
  readonly description = 'HubSphere analytics intelligence — KPI explanation, trend detection, anomaly detection, and cross-module insights';
  readonly requiredPermissions = ['dashboard.view'];

  async execute(params: AgentExecuteParams): Promise<AgentResponse> {
    const startTime = Date.now();

    if (!this.canExecute(params.userPermissions)) {
      throw new AuthorizationError(
        `Agent INSIGHT requires permissions: ${this.requiredPermissions.join(', ')}`
      );
    }

    this.validateTenant(params.tenantId);

    const systemPrompt =
      'You are INSIGHT, HubSphere\'s AI analytics intelligence assistant. You help users understand KPIs, detect trends, identify anomalies, and provide cross-module business insights. Mark suggestions clearly.';

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

    return { content: result.content, source: 'AI_ANALYSIS' };
  }

  /**
   * Explain a KPI change.
   */
  async explainKPI(
    kpiName: string,
    currentValue: number,
    previousValue: number,
    context?: Record<string, unknown>,
    tenantId?: string,
    userId?: string,
  ): Promise<AgentResponse> {
    this.validateTenant(tenantId);

    const change = currentValue - previousValue;
    const percentChange = previousValue !== 0 ? ((change / Math.abs(previousValue)) * 100).toFixed(1) : 'N/A';

    const prompt = `You are INSIGHT, an analytics intelligence assistant. Explain the following KPI change in business-friendly language. Identify possible causes and suggest areas to investigate.

KPI: ${kpiName}
Current value: ${currentValue}
Previous value: ${previousValue}
Change: ${change > 0 ? '+' : ''}${change} (${percentChange}%)${context ? `\n\nContext: ${JSON.stringify(context, null, 2)}` : ''}`;

    const result = await this.callAI(prompt, tenantId!);

    if (!result) {
      return {
        content:
          'AI_NOT_CONFIGURED: No AI provider is configured. Please configure an AI provider in Settings > Providers.',
        source: 'AI_ANALYSIS',
      };
    }

    if (userId) {
      await this.logUsage({
        tenantId: tenantId!,
        userId,
        agentName: this.name,
        promptTokens: result.inputTokens,
        completionTokens: result.outputTokens,
        model: result.model,
        providerId: result.providerId,
        durationMs: 0,
        success: true,
      });
    }

    return { content: result.content, source: 'AI_ANALYSIS' };
  }

  /**
   * Detect trends in time-series data.
   */
  async detectTrends(
    data: Array<Record<string, unknown>>,
    metricName: string,
    tenantId?: string,
    userId?: string,
  ): Promise<AgentResponse> {
    this.validateTenant(tenantId);

    const prompt = `You are INSIGHT, an analytics intelligence assistant. Analyze the following time-series data for the metric "${metricName}". Identify any trends (upward, downward, seasonal, flat) and provide a clear summary.

Data:
${JSON.stringify(data, null, 2)}`;

    const result = await this.callAI(prompt, tenantId!);

    if (!result) {
      return {
        content:
          'AI_NOT_CONFIGURED: No AI provider is configured. Please configure an AI provider in Settings > Providers.',
        source: 'AI_ANALYSIS',
      };
    }

    if (userId) {
      await this.logUsage({
        tenantId: tenantId!,
        userId,
        agentName: this.name,
        promptTokens: result.inputTokens,
        completionTokens: result.outputTokens,
        model: result.model,
        providerId: result.providerId,
        durationMs: 0,
        success: true,
      });
    }

    return { content: result.content, source: 'AI_ANALYSIS' };
  }

  /**
   * Generate cross-module business insights.
   */
  async generateInsights(
    params: {
      tenantId: string;
      userId: string;
      userPermissions: string[];
      modules?: string[];
    },
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    if (!this.canExecute(params.userPermissions)) {
      throw new AuthorizationError(
        `Agent INSIGHT requires permissions: ${this.requiredPermissions.join(', ')}`
      );
    }

    this.validateTenant(params.tenantId);

    // Gather real cross-module data
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [leadCount, dealCount, openDeals, employeeCount, recentCalls] =
      await Promise.all([
        db.lead.count({ where: { tenantId: params.tenantId, createdAt: { gte: thirtyDaysAgo } } }),
        db.deal.count({ where: { tenantId: params.tenantId, createdAt: { gte: thirtyDaysAgo } } }),
        db.deal.count({ where: { tenantId: params.tenantId } }),
        db.employee.count({ where: { tenantId: params.tenantId, employmentStatus: 'ACTIVE' } }),
        db.call.count({ where: { tenantId: params.tenantId, createdAt: { gte: thirtyDaysAgo } } }),
      ]);

    const businessData = {
      period: 'last 30 days',
      newLeads: leadCount,
      newDeals: dealCount,
      openDeals,
      activeEmployees: employeeCount,
      callsMade: recentCalls,
      modules: params.modules ?? ['CRM', 'HRMS', 'Analytics'],
    };

    const prompt = `You are INSIGHT, HubSphere's analytics intelligence assistant. Provide cross-module business insights based on the following real data. Identify correlations, opportunities, and risks.

Business Data:
${JSON.stringify(businessData, null, 2)}`;

    const result = await this.callAI(prompt, params.tenantId);

    if (!result) {
      return {
        content:
          'AI_NOT_CONFIGURED: No AI provider is configured. Please configure an AI provider in Settings > Providers.',
        source: 'AI_ANALYSIS',
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

    return { content: result.content, source: 'AI_ANALYSIS', data: businessData };
  }

  /**
   * Basic anomaly detection in data.
   */
  async anomalyDetection(
    data: Array<Record<string, unknown>>,
    metricName: string,
    tenantId?: string,
    userId?: string,
  ): Promise<AgentResponse> {
    this.validateTenant(tenantId);

    const prompt = `You are INSIGHT, an analytics intelligence assistant. Analyze the following data for the metric "${metricName}" and identify any anomalies (unexpected spikes, drops, or unusual patterns). For each anomaly found, describe what is unusual and when it occurred.

Data:
${JSON.stringify(data, null, 2)}`;

    const result = await this.callAI(prompt, tenantId!);

    if (!result) {
      return {
        content:
          'AI_NOT_CONFIGURED: No AI provider is configured. Please configure an AI provider in Settings > Providers.',
        source: 'AI_ANALYSIS',
      };
    }

    if (userId) {
      await this.logUsage({
        tenantId: tenantId!,
        userId,
        agentName: this.name,
        promptTokens: result.inputTokens,
        completionTokens: result.outputTokens,
        model: result.model,
        providerId: result.providerId,
        durationMs: 0,
        success: true,
      });
    }

    return { content: result.content, source: 'AI_ANALYSIS' };
  }
}

export const insightAgent = new InsightAgent();
