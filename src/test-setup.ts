/**
 * Test setup file for Vitest.
 * Provides global mocks and configuration for the test suite.
 */

// Mock environment variables for testing
process.env.DATABASE_URL = 'postgresql://postgres.nhgijoqgekhhoonmrsru:ipgroup%409301056006@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long-for-security';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret-at-least-32-characters-long';
process.env.APP_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';

// Suppress console.log in tests (keep console.error and console.warn)
const originalLog = console.log;
beforeAll(() => {
  console.log = (...args: unknown[]) => {
    // Only suppress in test mode, allow explicit test logs
    if (process.env.VITEST_VERBOSE !== '1') return;
    originalLog.apply(console, args);
  };
});

afterAll(() => {
  console.log = originalLog;
});
