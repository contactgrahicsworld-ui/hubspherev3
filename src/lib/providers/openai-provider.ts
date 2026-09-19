/**
 * OpenAI AI Provider — concrete implementation of AIProvider.
 *
 * Uses native fetch() against the OpenAI REST API (no SDK dependency).
 * Features:
 *   - Timeout via AbortController (default 30 s)
 *   - Retry with exponential backoff (1 s, 2 s, 4 s → 3 attempts)
 *   - Rate-limit awareness (429 → honour Retry-After header)
 *   - Usage logging to AiUsageLog via Prisma
 *   - NEVER fakes a response — isConfigured() returns false if key missing
 */

import type { AIProvider, AIResponse, ProviderInfo, ProviderStatus } from './types';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

// ============================================
// CONSTANTS
// ============================================

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1_000; // 1 s, 2 s, 4 s

// ============================================
// CONFIGURATION
// ============================================

export interface OpenAIProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  /** Optional system prompt prepended to every request */
  systemPrompt?: string;
}

// ============================================
// ERROR TYPES
// ============================================

export class OpenAIAPIError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly retryAfter?: number;

  constructor(statusCode: number, code: string, message: string, retryAfter?: number) {
    super(message);
    this.name = 'OpenAIAPIError';
    this.statusCode = statusCode;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

// ============================================
// OPENAI RESPONSE TYPES
// ============================================

interface OpenAIChatResponse {
  id: string;
  object: string;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string | null };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

interface OpenAIModelsResponse {
  data: Array<{ id: string; object: string }>;
}

// ============================================
// HELPERS
// ============================================

/**
 * Create a simple hash of the prompt for logging/analytics.
 * Uses a fast non-cryptographic approach — uniqueness, not security, is the goal.
 */
function hashPrompt(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const chr = prompt.charCodeAt(i);
    hash = ((hash << 5) - hash + chr) | 0; // eslint-disable-line no-bitwise
  }
  return Math.abs(hash).toString(36);
}

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// OPENAI PROVIDER CLASS
// ============================================

export class OpenAIProvider implements AIProvider {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly systemPrompt: string | undefined;

  /** Cached health status — avoids hitting /models on every getInfo() call. */
  private lastStatus: ProviderStatus = 'NOT_CONFIGURED';
  private lastCheckAt: Date | undefined;

  constructor(config: OpenAIProviderConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
    this.model = config.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
    this.baseUrl = config.baseUrl ?? OPENAI_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? MAX_RETRIES;
    this.systemPrompt = config.systemPrompt;

    if (this.isConfigured()) {
      this.lastStatus = 'CONFIGURED';
      logger.info('OpenAI provider initialised', {
        module: 'openai-provider',
        model: this.model,
      });
    } else {
      logger.warn('OpenAI provider not configured — OPENAI_API_KEY is missing', {
        module: 'openai-provider',
      });
    }
  }

  // ============================================
  // AIProvider Interface
  // ============================================

  isConfigured(): boolean {
    return typeof this.apiKey === 'string' && this.apiKey.trim().length > 0;
  }

  getInfo(): ProviderInfo {
    return {
      providerId: 'openai',
      providerName: 'OpenAI',
      category: 'AIProvider',
      capabilities: ['chat-completion', 'streaming', 'function-calling'],
      status: this.lastStatus,
      priority: 10, // highest default priority
      lastCheckAt: this.lastCheckAt,
    };
  }

  async chatCompletion(
    prompt: string,
    context?: Record<string, unknown>,
  ): Promise<AIResponse> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI provider is not configured — OPENAI_API_KEY is missing');
    }

    const startTime = Date.now();
    let lastError: unknown;

    // Build OpenAI messages array
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (this.systemPrompt) {
      messages.push({ role: 'system', content: this.systemPrompt });
    }

    // Allow caller to pass prior conversation via context.messages
    if (context?.messages && Array.isArray(context.messages)) {
      for (const msg of context.messages as Array<{ role: string; content: string }>) {
        if (msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    messages.push({ role: 'user', content: prompt });

    // Allow caller to override model via context
    const model = (context?.model as string) ?? this.model;

    const body = JSON.stringify({
      model,
      messages,
      // Pass through supported OpenAI params from context
      ...(context?.temperature != null ? { temperature: context.temperature } : {}),
      ...(context?.max_tokens != null ? { max_tokens: context.max_tokens } : {}),
      ...(context?.top_p != null ? { top_p: context.top_p } : {}),
      ...(context?.response_format != null ? { response_format: context.response_format } : {}),
    });

    // Retry loop with exponential backoff
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // --- Handle rate limiting (429) ---
        if (response.status === 429) {
          const retryAfterHeader = response.headers.get('Retry-After');
          const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
          const retryAfterMs = retryAfterSec ? retryAfterSec * 1000 : BACKOFF_BASE_MS * Math.pow(2, attempt - 1);

          logger.warn('OpenAI rate limited (429)', {
            module: 'openai-provider',
            attempt,
            retryAfterSec,
          });

          // Log rate-limit event
          await this.logUsage({
            model,
            inputTokens: 0,
            outputTokens: 0,
            durationMs: Date.now() - startTime,
            status: 'RATE_LIMITED',
            promptHash: hashPrompt(prompt),
            tenantId: context?.tenantId as string | undefined,
            userId: context?.userId as string | undefined,
          });

          if (attempt < this.maxRetries) {
            await sleep(retryAfterMs);
            continue;
          }

          throw new OpenAIAPIError(
            429,
            'rate_limit_exceeded',
            'OpenAI API rate limit exceeded',
            retryAfterSec,
          );
        }

        // --- Handle other non-OK responses ---
        if (!response.ok) {
          const errorBody = await this.safeParseJson<OpenAIErrorResponse>(response);
          const errorMessage = errorBody?.error?.message ?? `HTTP ${response.status}`;
          const errorCode = errorBody?.error?.code ?? `http_${response.status}`;

          logger.error('OpenAI API error', {
            module: 'openai-provider',
            statusCode: response.status,
            errorCode,
            attempt,
            error: errorMessage,
          });

          // Non-retryable errors — throw immediately
          if (response.status === 401 || response.status === 403) {
            this.lastStatus = 'UNHEALTHY';
            this.lastCheckAt = new Date();
            throw new OpenAIAPIError(
              response.status,
              errorCode,
              `OpenAI authentication error: ${errorMessage}`,
            );
          }

          if (response.status === 400 || response.status === 404 || response.status === 422) {
            throw new OpenAIAPIError(
              response.status,
              errorCode,
              `OpenAI request error: ${errorMessage}`,
            );
          }

          // Server errors (500, 502, 503) — retry
          lastError = new OpenAIAPIError(response.status, errorCode, errorMessage);

          if (attempt < this.maxRetries) {
            const backoff = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
            logger.warn('OpenAI server error — retrying', {
              module: 'openai-provider',
              attempt,
              backoffMs: backoff,
              statusCode: response.status,
            });
            await sleep(backoff);
            continue;
          }

          throw lastError;
        }

        // --- Parse successful response ---
        const data = await this.safeParseJson<OpenAIChatResponse>(response);

        if (!data || !data.choices || data.choices.length === 0) {
          throw new OpenAIAPIError(
            500,
            'malformed_response',
            'OpenAI returned an empty or malformed choices array',
          );
        }

        const content = data.choices[0].message?.content ?? '';
        const inputTokens = data.usage?.prompt_tokens ?? 0;
        const outputTokens = data.usage?.completion_tokens ?? 0;
        const durationMs = Date.now() - startTime;

        this.lastStatus = 'HEALTHY';
        this.lastCheckAt = new Date();

        // Log successful usage
        await this.logUsage({
          model: data.model ?? model,
          inputTokens,
          outputTokens,
          durationMs,
          status: 'SUCCESS',
          promptHash: hashPrompt(prompt),
          tenantId: context?.tenantId as string | undefined,
          userId: context?.userId as string | undefined,
        });

        logger.info('OpenAI chat completion succeeded', {
          module: 'openai-provider',
          model: data.model ?? model,
          inputTokens,
          outputTokens,
          durationMs,
        });

        return {
          content,
          model: data.model ?? model,
          providerId: 'openai',
          usage: { inputTokens, outputTokens },
        };
      } catch (err) {
        clearTimeout(timeoutId);

        // AbortError = timeout
        if (err instanceof DOMException && err.name === 'AbortError') {
          logger.warn('OpenAI request timed out', {
            module: 'openai-provider',
            attempt,
            timeoutMs: this.timeoutMs,
          });

          lastError = new OpenAIAPIError(
            408,
            'request_timeout',
            `OpenAI request timed out after ${this.timeoutMs}ms`,
          );

          if (attempt < this.maxRetries) {
            const backoff = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
            await sleep(backoff);
            continue;
          }

          // Log timeout failure
          await this.logUsage({
            model,
            inputTokens: 0,
            outputTokens: 0,
            durationMs: Date.now() - startTime,
            status: 'FAILED',
            promptHash: hashPrompt(prompt),
            tenantId: context?.tenantId as string | undefined,
            userId: context?.userId as string | undefined,
          });

          throw lastError;
        }

        // Network errors (ECONNREFUSED, ENOTFOUND, fetch failed, etc.)
        if (err instanceof TypeError && err.message.includes('fetch')) {
          logger.error('OpenAI network error', {
            module: 'openai-provider',
            attempt,
            error: err.message,
          });

          lastError = new OpenAIAPIError(
            503,
            'network_error',
            `OpenAI network error: ${err.message}`,
          );

          if (attempt < this.maxRetries) {
            const backoff = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
            await sleep(backoff);
            continue;
          }

          await this.logUsage({
            model,
            inputTokens: 0,
            outputTokens: 0,
            durationMs: Date.now() - startTime,
            status: 'FAILED',
            promptHash: hashPrompt(prompt),
            tenantId: context?.tenantId as string | undefined,
            userId: context?.userId as string | undefined,
          });

          throw lastError;
        }

        // Re-throw our own error classes or unknown errors (no retry)
        if (err instanceof OpenAIAPIError) {
          throw err;
        }

        // Unknown error — retry on last attempt only
        lastError = err;
        if (attempt < this.maxRetries) {
          const backoff = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
          await sleep(backoff);
          continue;
        }

        await this.logUsage({
          model,
          inputTokens: 0,
          outputTokens: 0,
          durationMs: Date.now() - startTime,
          status: 'FAILED',
          promptHash: hashPrompt(prompt),
          tenantId: context?.tenantId as string | undefined,
          userId: context?.userId as string | undefined,
        });

        throw err;
      }
    }

    // Should never reach here, but just in case
    throw lastError ?? new Error('OpenAI provider: all retry attempts exhausted');
  }

  /**
   * Health check — calls the /models endpoint to verify the API key is valid.
   * Returns true if the API responds with 200, false otherwise.
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) {
      this.lastStatus = 'NOT_CONFIGURED';
      this.lastCheckAt = new Date();
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10 s timeout for health

      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        this.lastStatus = 'HEALTHY';
        this.lastCheckAt = new Date();
        logger.info('OpenAI health check passed', { module: 'openai-provider' });
        return true;
      }

      if (response.status === 401 || response.status === 403) {
        this.lastStatus = 'UNHEALTHY';
        this.lastCheckAt = new Date();
        logger.error('OpenAI health check failed — invalid credentials', {
          module: 'openai-provider',
          statusCode: response.status,
        });
        return false;
      }

      // Other errors — still mark as unhealthy
      this.lastStatus = 'UNHEALTHY';
      this.lastCheckAt = new Date();
      logger.warn('OpenAI health check failed', {
        module: 'openai-provider',
        statusCode: response.status,
      });
      return false;
    } catch (err) {
      this.lastStatus = 'UNHEALTHY';
      this.lastCheckAt = new Date();

      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('OpenAI health check error', {
        module: 'openai-provider',
        error: message,
      });
      return false;
    }
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Safely parse JSON from a fetch Response.
   * Returns null if parsing fails.
   */
  private async safeParseJson<T>(response: Response): Promise<T | null> {
    try {
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }

  /**
   * Log AI usage to the AiUsageLog table via Prisma.
   * Errors during logging are swallowed — logging must never break the provider.
   */
  private async logUsage(params: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    status: string;
    promptHash: string;
    tenantId?: string;
    userId?: string;
  }): Promise<void> {
    try {
      await db.aiUsageLog.create({
        data: {
          providerId: 'openai',
          model: params.model,
          inputTokens: params.inputTokens,
          outputTokens: params.outputTokens,
          durationMs: params.durationMs,
          status: params.status,
          promptHash: params.promptHash,
          tenantId: params.tenantId,
          userId: params.userId,
        },
      });
    } catch (err) {
      // Swallow — usage logging must never break the AI call
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.warn('Failed to log AI usage', {
        module: 'openai-provider',
        error: message,
      });
    }
  }
}
