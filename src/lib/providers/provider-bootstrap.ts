/**
 * Provider Bootstrap — registers all configured providers into the provider registry.
 *
 * Called once at app startup (e.g., instrumentation.ts or layout.tsx).
 * For each provider category:
 *   - If the required env var is set → register the concrete provider
 *   - If not set → register a stub with isConfigured() = false (for UI display)
 *
 * Also upserts provider config records into the ProviderConfig DB table
 * so the admin UI can show all available providers and their status.
 */

import { providerRegistry } from './registry';
import { OpenAIProvider } from './openai-provider';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import type { AIProvider, ProviderInfo, ProviderStatus } from './types';

// ============================================
// STUB PROVIDER
// ============================================

/**
 * A minimal provider stub that reports as NOT_CONFIGURED.
 * Used for providers whose API keys are not set — they still appear
 * in the registry so the admin UI can show them as available to configure.
 */
class StubAIProvider implements AIProvider {
  private readonly id: string;
  private readonly name: string;
  private readonly caps: string[];

  constructor(id: string, name: string, capabilities: string[] = []) {
    this.id = id;
    this.name = name;
    this.caps = capabilities;
  }

  isConfigured(): boolean {
    return false;
  }

  getInfo(): ProviderInfo {
    return {
      providerId: this.id,
      providerName: this.name,
      category: 'AIProvider',
      capabilities: this.caps,
      status: 'NOT_CONFIGURED' as ProviderStatus,
      priority: 0,
    };
  }

  async chatCompletion(): Promise<never> {
    throw new Error(`${this.name} provider is not configured`);
  }

  async healthCheck(): Promise<boolean> {
    return false;
  }
}

// ============================================
// PROVIDER DEFINITIONS
// ============================================

interface ProviderDefinition {
  id: string;
  name: string;
  category: string;
  capabilities: string[];
  envKey: string;
  priority: number;
}

const AI_PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    category: 'AIProvider',
    capabilities: ['chat-completion', 'streaming', 'function-calling'],
    envKey: 'OPENAI_API_KEY',
    priority: 10,
  },
  {
    id: 'google-ai',
    name: 'Google AI (Gemini)',
    category: 'AIProvider',
    capabilities: ['chat-completion', 'streaming', 'function-calling', 'vision'],
    envKey: 'GOOGLE_AI_API_KEY',
    priority: 5,
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    category: 'AIProvider',
    capabilities: ['chat-completion', 'streaming', 'function-calling', 'vision'],
    envKey: 'ANTHROPIC_API_KEY',
    priority: 8,
  },
];

// ============================================
// BOOTSTRAP FUNCTION
// ============================================

/**
 * Bootstrap all providers — register them into the provider registry
 * and sync their status to the ProviderConfig DB table.
 *
 * Should be called once at app startup (instrumentation.ts or similar).
 * Errors are logged but never thrown — the app must start even if
 * providers are unavailable or the database is down.
 */
export async function bootstrapProviders(): Promise<void> {
  logger.info('Bootstrapping providers…', { module: 'provider-bootstrap' });

  // ---- Register AI providers ----
  for (const def of AI_PROVIDER_DEFINITIONS) {
    const envValue = process.env[def.envKey];
    const isConfigured = typeof envValue === 'string' && envValue.trim().length > 0;

    if (def.id === 'openai') {
      // Concrete OpenAI provider
      const provider = new OpenAIProvider();
      providerRegistry.register(def.category, provider);
      logger.info(
        isConfigured ? 'OpenAI provider registered (configured)' : 'OpenAI provider registered (NOT configured)',
        { module: 'provider-bootstrap', providerId: def.id },
      );
    } else {
      // Stub providers for Google AI, Anthropic, etc.
      const stub = new StubAIProvider(def.id, def.name, def.capabilities);
      providerRegistry.register(def.category, stub);
      logger.info(
        `${def.name} provider registered as stub (not yet implemented)`,
        { module: 'provider-bootstrap', providerId: def.id },
      );
    }
  }

  // ---- Sync provider configs to DB ----
  await syncProviderConfigsToDB();

  const totalProviders = providerRegistry.size;
  logger.info(`Provider bootstrap complete — ${totalProviders} provider(s) registered`, {
    module: 'provider-bootstrap',
  });
}

// ============================================
// DB SYNC
// ============================================

/**
 * Upsert provider config records into the ProviderConfig table.
 * This ensures the admin UI always has a row for every known provider,
 * even if it's not configured yet.
 *
 * Errors are swallowed — the app must start even if the DB is down.
 */
async function syncProviderConfigsToDB(): Promise<void> {
  try {
    for (const def of AI_PROVIDER_DEFINITIONS) {
      const envValue = process.env[def.envKey];
      const isConfigured = typeof envValue === 'string' && envValue.trim().length > 0;

      await db.providerConfig.upsert({
        where: { providerId: def.id },
        create: {
          providerId: def.id,
          name: def.name,
          category: def.category,
          enabled: isConfigured,
          configured: isConfigured,
          healthy: null, // not yet checked
          config: {},
          priority: def.priority,
        },
        update: {
          name: def.name,
          category: def.category,
          configured: isConfigured,
          // Only update enabled if transitioning from unconfigured → configured
          ...(isConfigured ? { enabled: true } : {}),
          priority: def.priority,
        },
      });
    }

    logger.info('Provider configs synced to DB', { module: 'provider-bootstrap' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.warn('Failed to sync provider configs to DB (app will continue)', {
      module: 'provider-bootstrap',
      error: message,
    });
  }
}

// ============================================
// RE-EXPORTS (convenience)
// ============================================

export { providerRegistry } from './registry';
export { OpenAIProvider } from './openai-provider';
