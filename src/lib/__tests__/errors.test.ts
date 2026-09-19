/**
 * Tests for the centralized error handling system.
 * Covers AppError hierarchy, handleApiError, sanitization, and security.
 */

import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ProviderNotConfiguredError,
  ProviderUnhealthyError,
  handleApiError,
} from '@/lib/errors';

// ============================================
// ERROR CLASS TESTS
// ============================================

describe('AppError', () => {
  it('creates an error with correct properties', () => {
    const err = new AppError('test message', 'TEST_CODE', 418);
    expect(err.message).toBe('test message');
    expect(err.code).toBe('TEST_CODE');
    expect(err.statusCode).toBe(418);
    expect(err.details).toBeUndefined();
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('stores details when provided', () => {
    const details = { field: 'email', issue: 'invalid' };
    const err = new AppError('test', 'CODE', 400, details);
    expect(err.details).toEqual(details);
  });

  it('handles null and undefined details', () => {
    const err1 = new AppError('test', 'CODE', 400, null);
    const err2 = new AppError('test', 'CODE', 400, undefined);
    expect(err1.details).toBeNull();
    expect(err2.details).toBeUndefined();
  });
});

describe('AuthenticationError', () => {
  it('creates with default message and 401 status', () => {
    const err = new AuthenticationError();
    expect(err.message).toBe('Authentication required');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTHENTICATION_ERROR');
    expect(err.name).toBe('AuthenticationError');
  });

  it('creates with custom message', () => {
    const err = new AuthenticationError('Invalid token');
    expect(err.message).toBe('Invalid token');
  });

  it('is instanceof AppError and Error', () => {
    const err = new AuthenticationError();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('AuthorizationError', () => {
  it('creates with default message and 403 status', () => {
    const err = new AuthorizationError();
    expect(err.message).toBe('Insufficient permissions');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('AUTHORIZATION_ERROR');
  });
});

describe('ValidationError', () => {
  it('creates with default message and 400 status', () => {
    const err = new ValidationError();
    expect(err.message).toBe('Validation failed');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('stores validation details', () => {
    const details = [{ field: 'email', message: 'Invalid email' }];
    const err = new ValidationError('Validation failed', details);
    expect(err.details).toEqual(details);
  });
});

describe('NotFoundError', () => {
  it('creates with default message and 404 status', () => {
    const err = new NotFoundError();
    expect(err.message).toBe('Resource not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });
});

describe('ConflictError', () => {
  it('creates with default message and 409 status', () => {
    const err = new ConflictError();
    expect(err.message).toBe('Resource conflict');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });
});

describe('RateLimitError', () => {
  it('creates with default message and 429 status', () => {
    const err = new RateLimitError();
    expect(err.message).toBe('Too many requests');
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(err.retryAfter).toBeUndefined();
  });

  it('stores retryAfter when provided', () => {
    const err = new RateLimitError('Slow down', 60);
    expect(err.retryAfter).toBe(60);
  });
});

describe('ProviderNotConfiguredError', () => {
  it('creates with default message and 503 status', () => {
    const err = new ProviderNotConfiguredError();
    expect(err.message).toBe('Provider is not configured');
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('PROVIDER_NOT_CONFIGURED');
  });
});

describe('ProviderUnhealthyError', () => {
  it('creates with default message and 503 status', () => {
    const err = new ProviderUnhealthyError();
    expect(err.message).toBe('Provider health check failed');
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('PROVIDER_UNHEALTHY');
  });
});

// ============================================
// handleApiError TESTS
// ============================================

describe('handleApiError', () => {
  describe('with known AppError instances', () => {
    it('handles AuthenticationError', () => {
      const result = handleApiError(new AuthenticationError());
      expect(result.statusCode).toBe(401);
      expect(result.body.code).toBe('AUTHENTICATION_ERROR');
      expect(result.body.error).toBe('Authentication required');
    });

    it('handles AuthorizationError', () => {
      const result = handleApiError(new AuthorizationError());
      expect(result.statusCode).toBe(403);
      expect(result.body.code).toBe('AUTHORIZATION_ERROR');
    });

    it('handles ValidationError with details in non-development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const details = [{ field: 'email', message: 'Invalid' }];
      const result = handleApiError(new ValidationError('Validation failed', details));
      expect(result.statusCode).toBe(400);
      expect(result.body.code).toBe('VALIDATION_ERROR');
      // Validation errors always include details (they contain field names, not secrets)
      expect(result.body.details).toEqual(details);
      process.env.NODE_ENV = originalEnv;
    });

    it('handles NotFoundError', () => {
      const result = handleApiError(new NotFoundError('Lead not found'));
      expect(result.statusCode).toBe(404);
      expect(result.body.code).toBe('NOT_FOUND');
    });

    it('handles ConflictError', () => {
      const result = handleApiError(new ConflictError());
      expect(result.statusCode).toBe(409);
    });

    it('handles RateLimitError', () => {
      const result = handleApiError(new RateLimitError());
      expect(result.statusCode).toBe(429);
    });

    it('handles ProviderNotConfiguredError', () => {
      const result = handleApiError(new ProviderNotConfiguredError());
      expect(result.statusCode).toBe(503);
    });
  });

  describe('with Prisma errors', () => {
    it('handles P2002 unique constraint violation', () => {
      const prismaError = { code: 'P2002', meta: { target: ['email'] } };
      const result = handleApiError(prismaError);
      expect(result.statusCode).toBe(409);
      expect(result.body.code).toBe('CONFLICT');
      expect(result.body.error).toContain('email');
    });

    it('handles P2002 with non-array target', () => {
      const prismaError = { code: 'P2002', meta: {} };
      const result = handleApiError(prismaError);
      expect(result.statusCode).toBe(409);
      expect(result.body.error).toContain('field');
    });

    it('handles P2025 record not found', () => {
      const prismaError = { code: 'P2025' };
      const result = handleApiError(prismaError);
      expect(result.statusCode).toBe(404);
      expect(result.body.code).toBe('NOT_FOUND');
    });

    it('handles P2003 foreign key constraint violation', () => {
      const prismaError = { code: 'P2003' };
      const result = handleApiError(prismaError);
      expect(result.statusCode).toBe(400);
      expect(result.body.code).toBe('VALIDATION_ERROR');
    });

    it('handles P2023 inconsistent column data', () => {
      const prismaError = { code: 'P2023' };
      const result = handleApiError(prismaError);
      expect(result.statusCode).toBe(400);
      expect(result.body.error).toContain('Invalid ID format');
    });

    it('handles P2014 relation violation', () => {
      const prismaError = { code: 'P2014' };
      const result = handleApiError(prismaError);
      expect(result.statusCode).toBe(400);
    });

    it('handles P1001 database unavailable', () => {
      const prismaError = { code: 'P1001' };
      const result = handleApiError(prismaError);
      expect(result.statusCode).toBe(503);
      expect(result.body.code).toBe('DATABASE_UNAVAILABLE');
    });
  });

  describe('with Zod validation errors', () => {
    it('handles ZodError with issues', () => {
      const zodError = {
        name: 'ZodError',
        issues: [
          { path: ['email'], message: 'Invalid email format' },
          { path: ['password'], message: 'Password too short' },
        ],
      };
      const result = handleApiError(zodError);
      expect(result.statusCode).toBe(400);
      expect(result.body.code).toBe('VALIDATION_ERROR');
      expect(result.body.details).toEqual([
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password too short' },
      ]);
    });

    it('handles ZodError with nested path', () => {
      const zodError = {
        name: 'ZodError',
        issues: [
          { path: ['address', 'city'], message: 'Required' },
        ],
      };
      const result = handleApiError(zodError);
      expect(result.body.details).toEqual([
        { field: 'address.city', message: 'Required' },
      ]);
    });
  });

  describe('with SyntaxError', () => {
    it('handles malformed JSON in request body', () => {
      const syntaxError = new SyntaxError('Unexpected token in JSON');
      const result = handleApiError(syntaxError);
      expect(result.statusCode).toBe(400);
      expect(result.body.code).toBe('VALIDATION_ERROR');
      expect(result.body.error).toContain('Invalid JSON');
    });
  });

  describe('with PrismaClientValidationError', () => {
    it('handles invalid UUID format', () => {
      const error = { name: 'PrismaClientValidationError' };
      const result = handleApiError(error);
      expect(result.statusCode).toBe(400);
      expect(result.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('with generic errors', () => {
    it('handles connection errors as 503', () => {
      const error = new Error('ECONNREFUSED 127.0.0.1:5432');
      const result = handleApiError(error);
      expect(result.statusCode).toBe(503);
      expect(result.body.code).toBe('DATABASE_UNAVAILABLE');
    });

    it('handles non-connection Error as 500 in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const error = new Error('Some internal issue');
      const result = handleApiError(error);
      expect(result.statusCode).toBe(500);
      expect(result.body.error).toBe('Internal server error');
      process.env.NODE_ENV = originalEnv;
    });

    it('shows sanitized message in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const error = new Error('Some internal issue');
      const result = handleApiError(error);
      expect(result.statusCode).toBe(500);
      expect(result.body.error).toBe('Some internal issue');
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('with unknown error types', () => {
    it('handles string errors as 500', () => {
      const result = handleApiError('something went wrong');
      expect(result.statusCode).toBe(500);
      expect(result.body.code).toBe('INTERNAL_ERROR');
    });

    it('handles null as 500', () => {
      const result = handleApiError(null);
      expect(result.statusCode).toBe(500);
    });

    it('handles undefined as 500', () => {
      const result = handleApiError(undefined);
      expect(result.statusCode).toBe(500);
    });

    it('handles number as 500', () => {
      const result = handleApiError(42);
      expect(result.statusCode).toBe(500);
    });
  });

  describe('sensitive data sanitization', () => {
    it('never exposes passwords in error messages', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const error = new Error('Database password: mysecret123');
      const result = handleApiError(error);
      expect(result.body.error).not.toContain('mysecret123');
      expect(result.body.error).toBe('An internal error occurred');
      process.env.NODE_ENV = originalEnv;
    });

    it('never exposes API keys in error messages', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const error = new Error('Invalid api_key: sk-1234567890');
      const result = handleApiError(error);
      expect(result.body.error).not.toContain('sk-1234567890');
      process.env.NODE_ENV = originalEnv;
    });

    it('never exposes tokens in error messages', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const error = new Error('token expired: eyJhbGciOiJIUzI1NiJ9');
      const result = handleApiError(error);
      expect(result.body.error).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      process.env.NODE_ENV = originalEnv;
    });

    it('never exposes JWT_SECRET in error messages', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const error = new Error('JWT_SECRET is misconfigured');
      const result = handleApiError(error);
      expect(result.body.error).not.toContain('JWT_SECRET');
      process.env.NODE_ENV = originalEnv;
    });

    it('never exposes DATABASE_URL in error messages', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const error = new Error('DATABASE_URL connection failed');
      const result = handleApiError(error);
      expect(result.body.error).not.toContain('DATABASE_URL');
      process.env.NODE_ENV = originalEnv;
    });

    it('sanitizes sensitive keys in details objects', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const details = {
        password: 'secret123',
        api_key: 'sk-xxx',
        normalField: 'safe value',
      };
      const err = new AppError('Validation error', 'VALIDATION_ERROR', 400, details);
      const result = handleApiError(err);
      const resultDetails = result.body.details as Record<string, unknown>;
      expect(resultDetails).toBeDefined();
      expect(resultDetails.password).toBeUndefined();
      expect(resultDetails.api_key).toBeUndefined();
      expect(resultDetails.normalField).toBe('safe value');
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('stack traces hidden in production', () => {
    it('never includes stack trace in response', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const error = new AuthenticationError('test');
      const result = handleApiError(error);
      const bodyStr = JSON.stringify(result.body);
      expect(bodyStr).not.toContain('at ');
      expect(bodyStr).not.toContain('stack');
      process.env.NODE_ENV = originalEnv;
    });

    it('production hides internal error details', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const error = new Error('Internal processing failure with sensitive data');
      const result = handleApiError(error);
      expect(result.body.error).toBe('Internal server error');
      const bodyStr = JSON.stringify(result.body);
      expect(bodyStr).not.toContain('sensitive');
      process.env.NODE_ENV = originalEnv;
    });
  });
});
