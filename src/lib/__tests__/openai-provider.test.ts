/**
 * Tests for the OpenAI Provider.
 * Covers isConfigured, getInfo, chatCompletion, healthCheck, retry logic, rate limiting.
 */

import { OpenAIProvider, OpenAIAPIError } from '@/lib/providers/openai-provider';

// ============================================
// isConfigured TESTS
// ============================================

describe('OpenAIProvider.isConfigured', () => {
  it('returns false when no API key is set', () => {
    // Ensure OPENAI_API_KEY is not set for this test
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const provider = new OpenAIProvider({ apiKey: undefined });
    expect(provider.isConfigured()).toBe(false);

    // Restore
    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
  });

  it('returns true when API key is set in config', () => {
    const provider = new OpenAIProvider({ apiKey: 'sk-test-key-12345' });
    expect(provider.isConfigured()).toBe(true);
  });

  it('returns true when API key is set via env var', () => {
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-env-test-key';

    const provider = new OpenAIProvider();
    expect(provider.isConfigured()).toBe(true);

    // Restore
    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    else delete process.env.OPENAI_API_KEY;
  });

  it('returns false for empty string API key', () => {
    const provider = new OpenAIProvider({ apiKey: '' });
    expect(provider.isConfigured()).toBe(false);
  });

  it('returns false for whitespace-only API key', () => {
    const provider = new OpenAIProvider({ apiKey: '   ' });
    expect(provider.isConfigured()).toBe(false);
  });
});

// ============================================
// getInfo TESTS
// ============================================

describe('OpenAIProvider.getInfo', () => {
  it('returns proper structure', () => {
    const provider = new OpenAIProvider({ apiKey: 'sk-test' });
    const info = provider.getInfo();

    expect(info.providerId).toBe('openai');
    expect(info.providerName).toBe('OpenAI');
    expect(info.category).toBe('AIProvider');
    expect(info.capabilities).toContain('chat-completion');
    expect(info.capabilities).toContain('streaming');
    expect(info.capabilities).toContain('function-calling');
    expect(typeof info.priority).toBe('number');
    expect(info.priority).toBeGreaterThan(0);
  });

  it('returns NOT_CONFIGURED status when no API key', () => {
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const provider = new OpenAIProvider({ apiKey: undefined });
    const info = provider.getInfo();
    expect(info.status).toBe('NOT_CONFIGURED');

    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
  });

  it('returns CONFIGURED status when API key is present', () => {
    const provider = new OpenAIProvider({ apiKey: 'sk-test' });
    const info = provider.getInfo();
    expect(info.status).toBe('CONFIGURED');
  });
});

// ============================================
// chatCompletion TESTS
// ============================================

describe('OpenAIProvider.chatCompletion', () => {
  it('throws error when not configured', async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const provider = new OpenAIProvider({ apiKey: undefined });
    await expect(provider.chatCompletion('test prompt')).rejects.toThrow('not configured');

    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
  });
});

// ============================================
// healthCheck TESTS
// ============================================

describe('OpenAIProvider.healthCheck', () => {
  it('returns false when not configured', async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const provider = new OpenAIProvider({ apiKey: undefined });
    const healthy = await provider.healthCheck();
    expect(healthy).toBe(false);

    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
  });

  it('returns false for invalid API key', async () => {
    // Use a fake key that will get 401 from OpenAI
    const provider = new OpenAIProvider({
      apiKey: 'sk-invalid-key-for-testing',
      timeoutMs: 5000,
    });

    const healthy = await provider.healthCheck();
    expect(healthy).toBe(false);
  });
});

// ============================================
// Retry Logic TESTS
// ============================================

describe('OpenAIProvider retry logic', () => {
  it('retries on server errors and eventually succeeds', async () => {
    let callCount = 0;

    // Mock global fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) {
        // First call: server error
        return new Response(JSON.stringify({ error: { message: 'Internal error', code: 'internal_error' } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // Second call: success
      return new Response(JSON.stringify({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        model: 'gpt-4o-mini',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const provider = new OpenAIProvider({
        apiKey: 'sk-test-retry',
        maxRetries: 3,
        timeoutMs: 5000,
      });

      const response = await provider.chatCompletion('test');
      expect(response.content).toBe('Hello!');
      expect(callCount).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ============================================
// Rate Limit Handling TESTS
// ============================================

describe('OpenAIProvider rate limit handling', () => {
  it('handles 429 rate limit response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded', code: 'rate_limit_exceeded' } }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '1',
        },
      });
    };

    try {
      const provider = new OpenAIProvider({
        apiKey: 'sk-test-ratelimit',
        maxRetries: 1, // Will exhaust retries quickly
        timeoutMs: 5000,
      });

      await expect(provider.chatCompletion('test')).rejects.toThrow();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws OpenAIAPIError with statusCode 429 on rate limit', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ error: { message: 'Rate limit', code: 'rate_limit' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const provider = new OpenAIProvider({
        apiKey: 'sk-test-ratelimit2',
        maxRetries: 1,
        timeoutMs: 5000,
      });

      try {
        await provider.chatCompletion('test');
      } catch (err) {
        expect(err).toBeInstanceOf(OpenAIAPIError);
        expect((err as OpenAIAPIError).statusCode).toBe(429);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ============================================
// Authentication Error TESTS
// ============================================

describe('OpenAIProvider authentication errors', () => {
  it('throws immediately on 401 without retrying', async () => {
    let callCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      callCount++;
      return new Response(JSON.stringify({ error: { message: 'Invalid API key', code: 'invalid_api_key' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const provider = new OpenAIProvider({
        apiKey: 'sk-test-401',
        maxRetries: 3,
        timeoutMs: 5000,
      });

      await expect(provider.chatCompletion('test')).rejects.toThrow();
      // Should only call once (no retries on 401)
      expect(callCount).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ============================================
// Timeout TESTS
// ============================================

describe('OpenAIProvider timeout', () => {
  it('handles request timeout', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      // Simulate a very slow response
      await new Promise(resolve => setTimeout(resolve, 10000));
      return new Response('ok', { status: 200 });
    };

    try {
      const provider = new OpenAIProvider({
        apiKey: 'sk-test-timeout',
        maxRetries: 1,
        timeoutMs: 100, // Very short timeout
      });

      await expect(provider.chatCompletion('test')).rejects.toThrow();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
