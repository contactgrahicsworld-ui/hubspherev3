/**
 * Provider Registry - singleton that manages all providers.
 * In Phase 1, the registry starts empty (no providers configured).
 * The application works normally without any providers.
 */

import type {
  ProviderInfo,
  AnyProvider,
  AIProvider,
  SpeechToTextProvider,
  TextToSpeechProvider,
  TranslationProvider,
  TelephonyProvider,
  CallRecordingProvider,
  MessagingProvider,
  StorageProvider,
  NotificationProvider,
} from './types';

/**
 * Internal registered provider entry.
 */
interface RegisteredProvider {
  category: string;
  provider: AnyProvider;
  registeredAt: Date;
}

class ProviderRegistry {
  private providers: Map<string, RegisteredProvider> = new Map();

  /**
   * Register a provider under a category.
   * If a provider with the same providerId already exists, it will be replaced.
   */
  register(category: string, provider: AnyProvider): void {
    const info = provider.getInfo();
    this.providers.set(info.providerId, {
      category,
      provider,
      registeredAt: new Date(),
    });
  }

  /**
   * Unregister a provider by its ID.
   */
  unregister(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  /**
   * Get the highest-priority provider for a given category.
   * Returns null if no provider is registered for that category.
   */
  getProvider(
    category: string
  ): AnyProvider | null {
    let best: RegisteredProvider | null = null;

    for (const entry of this.providers.values()) {
      if (entry.category !== category) continue;
      if (!entry.provider.isConfigured()) continue;

      if (!best || entry.provider.getInfo().priority > best.provider.getInfo().priority) {
        best = entry;
      }
    }

    return best ? best.provider : null;
  }

  /**
   * Get all provider info objects for a given category.
   */
  getProvidersByCategory(category: string): ProviderInfo[] {
    const results: ProviderInfo[] = [];
    for (const entry of this.providers.values()) {
      if (entry.category === category) {
        results.push(entry.provider.getInfo());
      }
    }
    // Sort by priority descending
    results.sort((a, b) => b.priority - a.priority);
    return results;
  }

  /**
   * Get info for all registered providers.
   */
  getAllProviders(): ProviderInfo[] {
    const results: ProviderInfo[] = [];
    for (const entry of this.providers.values()) {
      results.push(entry.provider.getInfo());
    }
    return results;
  }

  /**
   * Run a health check on the highest-priority provider in a category.
   * Throws if the provider fails health check.
   */
  async checkHealth(category: string): Promise<void> {
    const provider = this.getProvider(category);
    if (!provider) {
      return; // No provider = nothing to check
    }
    const healthy = await provider.healthCheck();
    if (!healthy) {
      throw new Error(
        `Provider ${provider.getInfo().providerId} failed health check`
      );
    }
  }

  /**
   * Run health checks on all registered providers.
   * Collects and throws combined errors if any fail.
   */
  async checkAllHealth(): Promise<void> {
    const errors: string[] = [];

    for (const entry of this.providers.values()) {
      if (!entry.provider.isConfigured()) continue;

      try {
        const healthy = await entry.provider.healthCheck();
        if (!healthy) {
          errors.push(
            `Provider ${entry.provider.getInfo().providerId} is unhealthy`
          );
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error';
        errors.push(
          `Provider ${entry.provider.getInfo().providerId}: ${message}`
        );
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Health check failures: ${errors.join('; ')}`
      );
    }
  }

  /**
   * Check if any provider is registered for a category.
   */
  hasProvider(category: string): boolean {
    for (const entry of this.providers.values()) {
      if (entry.category === category) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get count of registered providers.
   */
  get size(): number {
    return this.providers.size;
  }
}

/**
 * Singleton provider registry instance.
 */
export const providerRegistry = new ProviderRegistry();
