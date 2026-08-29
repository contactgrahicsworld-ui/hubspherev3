/**
 * PEOPLEMIND — HubSphere HR Intelligence.
 * HR summaries, attendance analysis, leave trends, workforce suggestions.
 */

import { AgentBase, type AgentExecuteParams, type AgentResponse } from './agent-base';
import { db } from '@/lib/db';
import { AuthorizationError, ValidationError } from '@/lib/errors';

class PeopleMindAgent extends AgentBase {
  readonly name = 'PEOPLEMIND';
  readonly description = 'HubSphere HR intelligence — attendance analysis, leave trends, and workforce insights';
  readonly requiredPermissions = ['employees.view'];

  async execute(params: AgentExecuteParams): Promise<AgentResponse> {
    const startTime = Date.now();

    if (!this.canExecute(params.userPermissions)) {
      throw new AuthorizationError(
        `Agent PEOPLEMIND requires permissions: ${this.requiredPermissions.join(', ')}`
      );
    }

    this.validateTenant(params.tenantId);

    const systemPrompt =
      'You are PEOPLEMIND, HubSphere\'s AI HR intelligence assistant. You help users with HR analytics, attendance insights, leave management, and workforce planning. Mark suggestions clearly.';

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
   * HR summary using real DB data with AI interpretation.
   */
  async summarizeHR(
    params: { tenantId: string; userId: string; userPermissions: string[]; period?: string },
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    if (!this.canExecute(params.userPermissions)) {
      throw new AuthorizationError(
        `Agent PEOPLEMIND requires permissions: ${this.requiredPermissions.join(', ')}`
      );
    }

    this.validateTenant(params.tenantId);

    // Gather real HR data from DB
    const now = new Date();
    const periodStart = params.period === '30d'
      ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      : params.period === '90d'
        ? new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        : new Date(now.getFullYear(), now.getMonth(), 1); // default: this month

    const [totalEmployees, activeEmployees, pendingLeaves, approvedLeaves] =
      await Promise.all([
        db.employee.count({ where: { tenantId: params.tenantId } }),
        db.employee.count({ where: { tenantId: params.tenantId, employmentStatus: 'ACTIVE' } }),
        db.leaveRequest.count({ where: { tenantId: params.tenantId, status: 'PENDING' } }),
        db.leaveRequest.count({ where: { tenantId: params.tenantId, status: 'APPROVED', createdAt: { gte: periodStart } } }),
      ]);

    const hrData = {
      totalEmployees,
      activeEmployees,
      inactiveEmployees: totalEmployees - activeEmployees,
      pendingLeaveRequests: pendingLeaves,
      approvedLeavesInPeriod: approvedLeaves,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
    };

    const prompt = `You are PEOPLEMIND, an HR intelligence assistant. Provide a concise HR summary based on the following real data. Highlight any areas that need attention.

HR Data:
${JSON.stringify(hrData, null, 2)}`;

    const result = await this.callAI(prompt, params.tenantId);

    if (!result) {
      return {
        content:
          'AI_NOT_CONFIGURED: No AI provider is configured. Please configure an AI provider in Settings > Providers.',
        source: 'AI_SUMMARY',
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

    return { content: result.content, source: 'AI_SUMMARY', data: hrData };
  }

  /**
   * Attendance insights from real data.
   */
  async analyzeAttendance(
    attendanceData: Record<string, unknown>[],
    tenantId?: string,
    userId?: string,
  ): Promise<AgentResponse> {
    this.validateTenant(tenantId);

    const prompt = `You are PEOPLEMIND, an HR intelligence assistant. Analyze the following attendance data and provide insights on patterns, trends, and any concerns.

Attendance Data:
${JSON.stringify(attendanceData, null, 2)}`;

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
   * Leave trend analysis.
   */
  async analyzeLeave(
    leaveData: Record<string, unknown>[],
    tenantId?: string,
    userId?: string,
  ): Promise<AgentResponse> {
    this.validateTenant(tenantId);

    const prompt = `You are PEOPLEMIND, an HR intelligence assistant. Analyze the following leave data and identify trends, peak leave periods, and potential staffing concerns.

Leave Data:
${JSON.stringify(leaveData, null, 2)}`;

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
   * Workforce planning suggestions.
   */
  async suggestWorkforce(
    params: {
      tenantId: string;
      userId: string;
      userPermissions: string[];
      context?: Record<string, unknown>;
    },
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    if (!this.canExecute(params.userPermissions)) {
      throw new AuthorizationError(
        `Agent PEOPLEMIND requires permissions: ${this.requiredPermissions.join(', ')}`
      );
    }

    this.validateTenant(params.tenantId);

    // Gather department-level data
    const departments = await db.department.findMany({
      where: { tenantId: params.tenantId, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        employees: { select: { id: true } },
      },
    });

    const deptSummary = departments.map((d) => ({
      department: d.name,
      employeeCount: d.employees.length,
    }));

    const prompt = `You are PEOPLEMIND, an HR intelligence assistant. Based on the following department staffing data, suggest workforce improvements, hiring needs, or reallocation strategies.

Department Data:
${JSON.stringify(deptSummary, null, 2)}${params.context ? `\n\nAdditional context: ${JSON.stringify(params.context, null, 2)}` : ''}`;

    const result = await this.callAI(prompt, params.tenantId);

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
}

export const peopleMindAgent = new PeopleMindAgent();