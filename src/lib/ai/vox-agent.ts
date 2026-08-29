/**
 * VOX — HubSphere Telecalling Intelligence.
 * Analyzes call transcripts, generates summaries, sentiment analysis.
 */

import { AgentBase, type AgentExecuteParams, type AgentResponse } from './agent-base';
import { db } from '@/lib/db';
import { AuthorizationError, NotFoundError } from '@/lib/errors';

class VoxAgent extends AgentBase {
  readonly name = 'VOX';
  readonly description = 'HubSphere telecalling intelligence — call analysis, summaries, and follow-up suggestions';
  readonly requiredPermissions = ['calls.view'];

  async execute(params: AgentExecuteParams): Promise<AgentResponse> {
    // VOX execute delegates to analyzeCall if callId is in context
    const callId = params.context?.callId as string | undefined;
    if (callId) {
      return this.analyzeCall({
        callId,
        tenantId: params.tenantId,
        userId: params.userId,
        userPermissions: params.userPermissions,
      });
    }

    // General VOX chat — handle telephony questions
    const startTime = Date.now();

    if (!this.canExecute(params.userPermissions)) {
      throw new AuthorizationError(
        `Agent VOX requires permissions: ${this.requiredPermissions.join(', ')}`
      );
    }

    this.validateTenant(params.tenantId);

    const systemPrompt =
      'You are VOX, HubSphere\'s AI telecalling intelligence assistant. You help users with call analytics, telecalling strategies, and communication insights. Mark suggestions clearly.';

    const fullPrompt = `${systemPrompt}\n\nUser question: ${params.prompt}`;
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
   * Analyze a specific call by ID.
   */
  async analyzeCall(params: {
    callId: string;
    tenantId: string;
    userId: string;
    userPermissions: string[];
  }): Promise<AgentResponse> {
    const startTime = Date.now();

    if (!this.canExecute(params.userPermissions)) {
      throw new AuthorizationError(
        `Agent VOX requires permissions: ${this.requiredPermissions.join(', ')}`
      );
    }

    this.validateTenant(params.tenantId);

    // Fetch call with recording
    const call = await db.call.findFirst({
      where: { id: params.callId, tenantId: params.tenantId },
      include: {
        recordings: {
          where: { status: 'READY' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!call) {
      throw new NotFoundError('Call not found');
    }

    // Check if transcript exists
    const recording = call.recordings[0] ?? null;
    if (!recording?.transcript) {
      return {
        content:
          'STT_NOT_CONFIGURED: No transcript is available for this call. Please ensure a Speech-to-Text provider is configured and the call has been transcribed.',
        source: 'AI_ANALYSIS',
      };
    }

    const callContext = {
      direction: call.direction,
      callType: call.callType,
      callStatus: call.callStatus,
      duration: call.duration,
      callStartTime: call.callStartTime,
    };

    const prompt = `Analyze the following call transcript and provide insights including key topics discussed, overall sentiment, and action items.

Call context: ${JSON.stringify(callContext)}

Transcript:
${recording.transcript}`;

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

    return { content: result.content, source: 'AI_ANALYSIS' };
  }

  /**
   * Summarize a call transcript.
   */
  async generateSummary(
    transcript: string,
    tenantId?: string
  ): Promise<AgentResponse> {
    this.validateTenant(tenantId);

    const prompt = `Summarize the following call transcript concisely, covering key points, decisions made, and action items.

Transcript:
${transcript}`;

    const result = await this.callAI(prompt, tenantId!);

    if (!result) {
      return {
        content:
          'AI_NOT_CONFIGURED: No AI provider is configured. Please configure an AI provider in Settings > Providers.',
        source: 'AI_SUMMARY',
      };
    }

    return { content: result.content, source: 'AI_SUMMARY' };
  }

  /**
   * Analyze sentiment of a call transcript.
   */
  async analyzeSentiment(
    transcript: string,
    tenantId?: string
  ): Promise<AgentResponse> {
    this.validateTenant(tenantId);

    const prompt = `Analyze the sentiment of the following call transcript. Provide an overall sentiment label (POSITIVE, NEGATIVE, NEUTRAL, or MIXED) with a brief explanation.

Transcript:
${transcript}`;

    const result = await this.callAI(prompt, tenantId!);

    if (!result) {
      return {
        content:
          'AI_NOT_CONFIGURED: No AI provider is configured. Please configure an AI provider in Settings > Providers.',
        source: 'AI_ANALYSIS',
      };
    }

    return { content: result.content, source: 'AI_ANALYSIS' };
  }

  /**
   * Extract key topics/keywords from a call transcript.
   */
  async extractKeywords(
    transcript: string,
    tenantId?: string
  ): Promise<AgentResponse> {
    this.validateTenant(tenantId);

    const prompt = `Extract the key topics and keywords from the following call transcript. Return them as a structured list with brief descriptions.

Transcript:
${transcript}`;

    const result = await this.callAI(prompt, tenantId!);

    if (!result) {
      return {
        content:
          'AI_NOT_CONFIGURED: No AI provider is configured. Please configure an AI provider in Settings > Providers.',
        source: 'AI_ANALYSIS',
      };
    }

    return { content: result.content, source: 'AI_ANALYSIS' };
  }

  /**
   * Suggest follow-up actions based on a call transcript and context.
   */
  async suggestFollowUp(
    transcript: string,
    callContext: Record<string, unknown>,
    tenantId?: string
  ): Promise<AgentResponse> {
    this.validateTenant(tenantId);

    const prompt = `Based on the following call transcript and context, suggest the best follow-up actions.

Call context: ${JSON.stringify(callContext)}

Transcript:
${transcript}`;

    const result = await this.callAI(prompt, tenantId!);

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

export const voxAgent = new VoxAgent();
