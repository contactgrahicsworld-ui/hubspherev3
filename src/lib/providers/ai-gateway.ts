/**
 * AI Gateway - routes AI requests to the highest-priority available provider.
 * If no AI provider is configured, throws ProviderNotConfiguredError.
 * NEVER fakes a response.
 */

import { providerRegistry } from './registry';
import { ProviderNotConfiguredError, ProviderUnhealthyError } from '@/lib/errors';
import type { AIResponse } from './types';

class AIGateway {
  /**
   * Process an AI chat completion request.
   * Routes to the highest-priority configured AI provider.
   *
   * @throws ProviderNotConfiguredError if no AI provider is configured
   * @throws ProviderUnhealthyError if the provider fails
   */
  async process(
    prompt: string,
    tenantId?: string,
    options?: Record<string, unknown>
  ): Promise<AIResponse> {
    const provider = providerRegistry.getProvider('AIProvider');

    if (!provider) {
      throw new ProviderNotConfiguredError(
        'No AI provider is configured. Please configure an AI provider (e.g., OpenAI) to use AI features.'
      );
    }

    try {
      // Merge tenantId into context if provided
      const context = {
        ...options,
        ...(tenantId ? { tenantId } : {}),
      };

      return await provider.chatCompletion(prompt, context);
    } catch (err) {
      if (err instanceof ProviderNotConfiguredError) {
        throw err;
      }
      throw new ProviderUnhealthyError(
        `AI provider failed to process request: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if an AI provider is available.
   */
  isAvailable(): boolean {
    const provider = providerRegistry.getProvider('AIProvider');
    return provider !== null;
  }

  /**
   * Get the current status of the AI gateway.
   */
  getStatus(): {
    available: boolean;
    provider: string | null;
    reason?: string;
  } {
    const provider = providerRegistry.getProvider('AIProvider');

    if (!provider) {
      return {
        available: false,
        provider: null,
        reason: 'No AI provider configured',
      };
    }

    const info = provider.getInfo();
    return {
      available: true,
      provider: info.providerName,
    };
  }
}

/**
 * Singleton AI gateway instance.
 */
export const aiGateway = new AIGateway();
