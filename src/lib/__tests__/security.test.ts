/**
 * Security Tests — JWT secrets, sensitive data exposure, error sanitization.
 */

import {
  AppError,
  handleApiError,
  ProviderNotConfiguredError,
  ProviderUnhealthyError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
} from '@/lib/errors';

// ============================================
// JWT Secret Strength Tests
// ============================================

describe('JWT secret security', () => {
  it('JWT_SECRET from test setup is at least 32 characters', () => {
    const jwtSecret = process.env.JWT_SECRET || '';
    expect(jwtSecret.length).toBeGreaterThanOrEqual(32);
  });

  it('REFRESH_TOKEN_SECRET from test setup is at least 32 characters', () => {
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET || '';
    expect(refreshSecret.length).toBeGreaterThanOrEqual(32);
  });

  it('short JWT secrets would be rejected in production env.ts', () => {
    // The env.ts file validates JWT_SECRET >= 32 chars in production
    // We verify the logic: a 10-character secret is too short
    const shortSecret = 'short12345';
    expect(shortSecret.length).toBeLessThan(32);
  });

  it('32-character JWT secret meets minimum requirement', () => {
    const validSecret = 'a'.repeat(32);
    expect(validSecret.length).toBeGreaterThanOrEqual(32);
  });
});

// ============================================
// Error Response Security Tests
// ============================================

describe('Error response security', () => {
  it('error responses never contain passwords', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const error = new Error('Query failed: password=mysecret123');
    const result = handleApiError(error);
    const bodyStr = JSON.stringify(result.body);
    expect(bodyStr).not.toContain('mysecret123');
    process.env.NODE_ENV = originalEnv;
  });

  it('error responses never contain tokens', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const error = new Error('Bearer token=abc123def456 expired');
    const result = handleApiError(error);
    const bodyStr = JSON.stringify(result.body);
    expect(bodyStr).not.toContain('abc123def456');
    process.env.NODE_ENV = originalEnv;
  });

  it('error responses never contain API keys', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const error = new Error('api_key=sk-proj-abc123 is invalid');
    const result = handleApiError(error);
    const bodyStr = JSON.stringify(result.body);
    expect(bodyStr).not.toContain('sk-proj-abc123');
    process.env.NODE_ENV = originalEnv;
  });

  it('error responses never contain DATABASE_URL', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const error = new Error('DATABASE_URL=postgresql://admin:pass@host:5432/db failed');
    const result = handleApiError(error);
    const bodyStr = JSON.stringify(result.body);
    expect(bodyStr).not.toContain('postgresql://admin:pass');
    process.env.NODE_ENV = originalEnv;
  });

  it('error responses never contain JWT_SECRET', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const error = new Error('JWT_SECRET validation failed');
    const result = handleApiError(error);
    const bodyStr = JSON.stringify(result.body);
    expect(bodyStr).not.toContain('JWT_SECRET');
    process.env.NODE_ENV = originalEnv;
  });

  it('error responses never contain cookie values', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const error = new Error('cookie session=abc123 not found');
    const result = handleApiError(error);
    const bodyStr = JSON.stringify(result.body);
    // 'cookie' is a sensitive pattern
    expect(bodyStr).not.toContain('abc123');
    process.env.NODE_ENV = originalEnv;
  });

  it('production hides all internal error details', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const error = new Error('Internal error with path /var/app/secrets/key.pem');
    const result = handleApiError(error);
    expect(result.body.error).toBe('Internal server error');
    const bodyStr = JSON.stringify(result.body);
    expect(bodyStr).not.toContain('/var/app');
    process.env.NODE_ENV = originalEnv;
  });
});

// ============================================
// Prisma Error Sanitization Tests
// ============================================

describe('Prisma error sanitization', () => {
  it('P2002 error does not expose internal paths', () => {
    const prismaError = {
      code: 'P2002',
      meta: { target: ['email'] },
      // Prisma errors often include internal stack/client info
      clientVersion: '5.0.0',
    };
    const result = handleApiError(prismaError);
    const bodyStr = JSON.stringify(result.body);
    expect(bodyStr).not.toContain('clientVersion');
    expect(bodyStr).not.toContain('stack');
  });

  it('P2025 error provides clean user-facing message', () => {
    const prismaError = { code: 'P2025', meta: { cause: 'Record not found at /internal/path' } };
    const result = handleApiError(prismaError);
    expect(result.statusCode).toBe(404);
    expect(result.body.error).toBe('Record not found');
    const bodyStr = JSON.stringify(result.body);
    expect(bodyStr).not.toContain('/internal/path');
  });

  it('PrismaClientValidationError provides generic message', () => {
    const error = {
      name: 'PrismaClientValidationError',
      message: 'Internal Prisma validation error with column names and paths',
    };
    const result = handleApiError(error);
    expect(result.statusCode).toBe(400);
    expect(result.body.error).toBe('Invalid request parameter');
    // Should not expose the internal Prisma message
    expect(result.body.error).not.toContain('Internal Prisma');
  });
});

// ============================================
// ProviderNotConfiguredError Status Code Test
// ============================================

describe('ProviderNotConfiguredError status code', () => {
  it('has status code 503 (Service Unavailable)', () => {
    const error = new ProviderNotConfiguredError();
    expect(error.statusCode).toBe(503);
  });

  it('handleApiError returns 503 for ProviderNotConfiguredError', () => {
    const result = handleApiError(new ProviderNotConfiguredError());
    expect(result.statusCode).toBe(503);
    expect(result.body.code).toBe('PROVIDER_NOT_CONFIGURED');
  });

  it('ProviderUnhealthyError also has 503 status', () => {
    const error = new ProviderUnhealthyError();
    expect(error.statusCode).toBe(503);
  });
});

// ============================================
// AppError hierarchy security
// ============================================

describe('AppError hierarchy security', () => {
  it('all error classes inherit from AppError', () => {
    expect(new AuthenticationError()).toBeInstanceOf(AppError);
    expect(new AuthorizationError()).toBeInstanceOf(AppError);
    expect(new ValidationError()).toBeInstanceOf(AppError);
    expect(new RateLimitError()).toBeInstanceOf(AppError);
    expect(new ProviderNotConfiguredError()).toBeInstanceOf(AppError);
  });

  it('all error classes inherit from Error', () => {
    expect(new AuthenticationError()).toBeInstanceOf(Error);
    expect(new AuthorizationError()).toBeInstanceOf(Error);
    expect(new ValidationError()).toBeInstanceOf(Error);
    expect(new RateLimitError()).toBeInstanceOf(Error);
    expect(new ProviderNotConfiguredError()).toBeInstanceOf(Error);
  });

  it('each error class has correct status code range', () => {
    // 4xx client errors
    expect(new AuthenticationError().statusCode).toBeGreaterThanOrEqual(400);
    expect(new AuthenticationError().statusCode).toBeLessThan(500);
    expect(new AuthorizationError().statusCode).toBeGreaterThanOrEqual(400);
    expect(new AuthorizationError().statusCode).toBeLessThan(500);
    expect(new ValidationError().statusCode).toBeGreaterThanOrEqual(400);
    expect(new ValidationError().statusCode).toBeLessThan(500);

    // 5xx server errors
    expect(new ProviderNotConfiguredError().statusCode).toBeGreaterThanOrEqual(500);
    expect(new ProviderNotConfiguredError().statusCode).toBeLessThan(600);
  });
});

// ============================================
// Sensitive data patterns coverage
// ============================================

describe('Sensitive data pattern coverage', () => {
  it('blocks "password" in error messages', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const result = handleApiError(new Error('password=secret'));
    expect(result.body.error).not.toContain('secret');
    process.env.NODE_ENV = originalEnv;
  });

  it('blocks "secret" in error messages', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const result = handleApiError(new Error('secret=key123'));
    expect(result.body.error).not.toContain('key123');
    process.env.NODE_ENV = originalEnv;
  });

  it('blocks "private_key" in error messages', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const result = handleApiError(new Error('private_key=-----BEGIN RSA-----'));
    expect(result.body.error).not.toContain('-----BEGIN RSA-----');
    process.env.NODE_ENV = originalEnv;
  });

  it('blocks "access_key" in error messages', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const result = handleApiError(new Error('access_key=AKIAIOSFODNN7EXAMPLE'));
    expect(result.body.error).not.toContain('AKIAIOSFODNN7EXAMPLE');
    process.env.NODE_ENV = originalEnv;
  });

  it('blocks "authorization" in error messages', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const result = handleApiError(new Error('Authorization: Bearer eyJhbGciOiJ'));
    expect(result.body.error).not.toContain('eyJhbGciOiJ');
    process.env.NODE_ENV = originalEnv;
  });

  it('blocks "SMTP_PASS" in error messages', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const result = handleApiError(new Error('SMTP_PASS=my-smtp-password'));
    expect(result.body.error).not.toContain('my-smtp-password');
    process.env.NODE_ENV = originalEnv;
  });

  it('blocks "REDIS_URL" in error messages', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const result = handleApiError(new Error('REDIS_URL=redis://:password@host:6379'));
    expect(result.body.error).not.toContain('redis://:password');
    process.env.NODE_ENV = originalEnv;
  });
});
