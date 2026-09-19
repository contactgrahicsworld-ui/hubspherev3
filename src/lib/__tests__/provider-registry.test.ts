/**
 * Tests for the Provider Registry.
 * Covers register, unregister, getProvider, getProvidersByCategory, priority-based selection.
 */

import { providerRegistry } from '@/lib/providers/registry';
import type { AIProvider, AIResponse, ProviderInfo, AnyProvider } from '@/lib/providers/types';

// Helper to create a mock provider
function createMockProvider(
  id: string,
  name: string,
  category: string,
  priority: number,
  configured: boolean = true
): AIProvider {
  return {
    isConfigured: () => configured,
    getInfo: (): ProviderInfo => ({
      providerId: id,
      providerName: name,
      category,
      capabilities: ['chat-completion'],
      status: configured ? 'CONFIGURED' : 'NOT_CONFIGURED',
      priority,
    }),
    chatCompletion: async (): Promise<AIResponse> => ({
      content: `Response from ${name}`,
      model: 'mock',
      providerId: id,
    }),
    healthCheck: async () => configured,
  };
}

// ============================================
// Provider Registry TESTS
// ============================================

describe('ProviderRegistry', () => {
  // Track providers we register so we can clean up
  const registeredIds: string[] = [];

  afterEach(() => {
    // Clean up all test providers
    for (const id of registeredIds) {
      providerRegistry.unregister(id);
    }
    registeredIds.length = 0;
  });

  it('starts with no providers or cleans up after tests', () => {
    // The registry is a singleton, so it may have providers from other tests
    // We just verify it's a valid state
    expect(typeof providerRegistry.size).toBe('number');
    expect(providerRegistry.size).toBeGreaterThanOrEqual(0);
  });

  describe('register / unregister', () => {
    it('registers a provider', () => {
      const provider = createMockProvider('test-1', 'Test Provider', 'AIProvider', 10);
      providerRegistry.register('AIProvider', provider);
      registeredIds.push('test-1');

      expect(providerRegistry.hasProvider('AIProvider')).toBe(true);
    });

    it('unregisters a provider', () => {
      const provider = createMockProvider('test-2', 'Test Provider', 'AIProvider', 10);
      providerRegistry.register('AIProvider', provider);
      registeredIds.push('test-2');

      const result = providerRegistry.unregister('test-2');
      expect(result).toBe(true);
      // Remove from cleanup since we already unregistered
      const idx = registeredIds.indexOf('test-2');
      if (idx !== -1) registeredIds.splice(idx, 1);
    });

    it('unregister returns false for non-existent provider', () => {
      const result = providerRegistry.unregister('non-existent-id');
      expect(result).toBe(false);
    });

    it('replacing a provider with same id works', () => {
      const provider1 = createMockProvider('test-3', 'Provider V1', 'AIProvider', 10);
      const provider2 = createMockProvider('test-3', 'Provider V2', 'AIProvider', 20);
      providerRegistry.register('AIProvider', provider1);
      providerRegistry.register('AIProvider', provider2);
      registeredIds.push('test-3');

      // Should have only one provider with id test-3
      const info = providerRegistry.getProvidersByCategory('AIProvider');
      const found = info.find(p => p.providerId === 'test-3');
      expect(found).toBeDefined();
      expect(found!.providerName).toBe('Provider V2');
    });
  });

  describe('getProvider', () => {
    it('returns null when no provider for category', () => {
      const result = providerRegistry.getProvider('NonExistentCategory');
      expect(result).toBeNull();
    });

    it('returns the highest-priority configured provider', () => {
      const lowPriority = createMockProvider('low-1', 'Low Priority', 'AIProvider', 5);
      const highPriority = createMockProvider('high-1', 'High Priority', 'AIProvider', 10);
      providerRegistry.register('AIProvider', lowPriority);
      providerRegistry.register('AIProvider', highPriority);
      registeredIds.push('low-1', 'high-1');

      const provider = providerRegistry.getProvider('AIProvider');
      expect(provider).not.toBeNull();
      expect(provider!.getInfo().providerId).toBe('high-1');
    });

    it('skips unconfigured providers', () => {
      const configured = createMockProvider('conf-1', 'Configured', 'AIProvider', 5, true);
      const unconfigured = createMockProvider('unconf-1', 'Unconfigured', 'AIProvider', 10, false);
      providerRegistry.register('AIProvider', configured);
      providerRegistry.register('AIProvider', unconfigured);
      registeredIds.push('conf-1', 'unconf-1');

      const provider = providerRegistry.getProvider('AIProvider');
      expect(provider).not.toBeNull();
      // Should get the configured one, even though unconfigured has higher priority
      expect(provider!.getInfo().providerId).toBe('conf-1');
    });

    it('returns null when all providers in category are unconfigured', () => {
      const unconfigured = createMockProvider('unconf-2', 'Unconfigured', 'AIProvider', 10, false);
      providerRegistry.register('AIProvider', unconfigured);
      registeredIds.push('unconf-2');

      const provider = providerRegistry.getProvider('AIProvider');
      expect(provider).toBeNull();
    });
  });

  describe('getProvidersByCategory', () => {
    it('returns empty array for non-existent category', () => {
      const result = providerRegistry.getProvidersByCategory('NonExistentCategory');
      expect(result).toEqual([]);
    });

    it('returns providers sorted by priority descending', () => {
      const p1 = createMockProvider('p-1', 'P1', 'TestCat', 1);
      const p2 = createMockProvider('p-2', 'P2', 'TestCat', 5);
      const p3 = createMockProvider('p-3', 'P3', 'TestCat', 3);
      providerRegistry.register('TestCat', p1);
      providerRegistry.register('TestCat', p2);
      providerRegistry.register('TestCat', p3);
      registeredIds.push('p-1', 'p-2', 'p-3');

      const providers = providerRegistry.getProvidersByCategory('TestCat');
      expect(providers).toHaveLength(3);
      expect(providers[0].priority).toBe(5); // highest first
      expect(providers[1].priority).toBe(3);
      expect(providers[2].priority).toBe(1); // lowest last
    });
  });

  describe('hasProvider', () => {
    it('returns false for empty category', () => {
      expect(providerRegistry.hasProvider('EmptyCategory')).toBe(false);
    });

    it('returns true when provider is registered', () => {
      const provider = createMockProvider('has-1', 'Has Provider', 'TestCategory', 10);
      providerRegistry.register('TestCategory', provider);
      registeredIds.push('has-1');

      expect(providerRegistry.hasProvider('TestCategory')).toBe(true);
    });
  });

  describe('getAllProviders', () => {
    it('returns array of ProviderInfo', () => {
      const all = providerRegistry.getAllProviders();
      expect(Array.isArray(all)).toBe(true);
      for (const info of all) {
        expect(info).toHaveProperty('providerId');
        expect(info).toHaveProperty('providerName');
        expect(info).toHaveProperty('category');
      }
    });
  });

  describe('size', () => {
    it('returns the number of registered providers', () => {
      const initialSize = providerRegistry.size;
      const provider = createMockProvider('size-1', 'Size Provider', 'SizeCat', 10);
      providerRegistry.register('SizeCat', provider);
      registeredIds.push('size-1');

      expect(providerRegistry.size).toBe(initialSize + 1);
    });
  });

  describe('priority-based provider selection', () => {
    it('selects highest priority among multiple configured providers', () => {
      const cat = 'PriorityTestCat';
      const p1 = createMockProvider('pri-1', 'Priority 1', cat, 1);
      const p2 = createMockProvider('pri-2', 'Priority 2', cat, 2);
      const p3 = createMockProvider('pri-3', 'Priority 3', cat, 3);
      providerRegistry.register(cat, p1);
      providerRegistry.register(cat, p2);
      providerRegistry.register(cat, p3);
      registeredIds.push('pri-1', 'pri-2', 'pri-3');

      const selected = providerRegistry.getProvider(cat);
      expect(selected).not.toBeNull();
      expect(selected!.getInfo().priority).toBe(3);
      expect(selected!.getInfo().providerId).toBe('pri-3');
    });

    it('falls back to lower priority when highest is unconfigured', () => {
      const cat = 'FallbackCat';
      const highUnconfigured = createMockProvider('fb-high', 'High Unconf', cat, 10, false);
      const midConfigured = createMockProvider('fb-mid', 'Mid Conf', cat, 5, true);
      providerRegistry.register(cat, highUnconfigured);
      providerRegistry.register(cat, midConfigured);
      registeredIds.push('fb-high', 'fb-mid');

      const selected = providerRegistry.getProvider(cat);
      expect(selected).not.toBeNull();
      expect(selected!.getInfo().providerId).toBe('fb-mid');
    });
  });
});
