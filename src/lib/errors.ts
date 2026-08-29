/**
 * Application error classes and centralized error handler.
 * Never exposes secrets, internal paths, or stack traces in production.
 */

/**
 * Base application error with structured fields.
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Authentication failure (401) - the caller is not authenticated.
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details?: unknown) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization failure (403) - the caller is authenticated but lacks permission.
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', details?: unknown) {
    super(message, 'AUTHORIZATION_ERROR', 403, details);
    this.name = 'AuthorizationError';
  }
}

/**
 * Resource not found (404).
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 'NOT_FOUND', 404, details);
    this.name = 'NotFoundError';
  }
}

/**
 * Input validation failure (400).
 */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Duplicate / conflict (409).
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details?: unknown) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}

/**
 * Rate limit exceeded (429).
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(message = 'Too many requests', retryAfter?: number, details?: unknown) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, details);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Provider is not configured (503).
 */
export class ProviderNotConfiguredError extends AppError {
  constructor(message = 'Provider is not configured', details?: unknown) {
    super(message, 'PROVIDER_NOT_CONFIGURED', 503, details);
    this.name = 'ProviderNotConfiguredError';
  }
}

/**
 * Provider is configured but failing health checks (503).
 */
export class ProviderUnhealthyError extends AppError {
  constructor(message = 'Provider health check failed', details?: unknown) {
    super(message, 'PROVIDER_UNHEALTHY', 503, details);
    this.name = 'ProviderUnhealthyError';
  }
}

/**
 * Sensitive field patterns that must never be exposed in error responses.
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /authorization/i,
  /cookie/i,
  /credentials/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
  /auth[_-]?token/i,
  /Bearer/i,
  /DATABASE_URL/i,
  /JWT_SECRET/i,
  /REDIS_URL/i,
  /SMTP_PASS/i,
];

/**
 * Check if a string might contain sensitive information.
 */
function mayContainSensitiveData(str: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(str));
}

/**
 * Sanitize an error message to remove sensitive information.
 */
function sanitizeMessage(message: string): string {
  if (mayContainSensitiveData(message)) {
    return 'An internal error occurred';
  }
  return message;
}

/**
 * Sanitize details to strip out any sensitive fields from objects.
 */
function sanitizeDetails(details: unknown): unknown {
  if (details == null || typeof details !== 'object') {
    return undefined;
  }

  if (Array.isArray(details)) {
    return details.map(sanitizeDetails);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (mayContainSensitiveData(key)) {
      continue; // skip sensitive keys
    }
    if (typeof value === 'string' && mayContainSensitiveData(value)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeDetails(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Centralized API error handler.
 * Converts any thrown error into a safe, structured response.
 * NEVER exposes secrets, stack traces, or internal details in production.
 */
export function handleApiError(error: unknown): {
  statusCode: number;
  body: {
    error: string;
    code: string;
    details?: unknown;
  };
} {
  // Handle known application errors
  if (error instanceof AppError) {
    const isDev = process.env.NODE_ENV === 'development';
    return {
      statusCode: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
        // Only include details in development
        ...(isDev && error.details !== undefined
          ? { details: sanitizeDetails(error.details) }
          : {}),
      },
    };
  }

  // Handle Zod validation errors (Zod v4 uses ZodError)
  // ZodError is exported from 'zod' and has a similar shape
  if (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name: string }).name === 'ZodError' &&
    'issues' in error
  ) {
    const zodError = error as {
      issues: Array<{ path: (string | number)[]; message: string }>;
    };
    return {
      statusCode: 400,
      body: {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: zodError.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    };
  }

  // Handle Prisma known errors
  if (
    error !== null &&
    typeof error === 'object' &&
    'code' in error
  ) {
    const prismaError = error as { code: string; meta?: Record<string, unknown> };

    switch (prismaError.code) {
      case 'P2002': {
        // Unique constraint violation
        const target = Array.isArray(prismaError.meta?.target)
          ? (prismaError.meta.target as string[]).join(', ')
          : 'field';
        return {
          statusCode: 409,
          body: {
            error: `A record with this ${target} already exists`,
            code: 'CONFLICT',
          },
        };
      }
      case 'P2025': {
        // Record not found
        return {
          statusCode: 404,
          body: {
            error: 'Record not found',
            code: 'NOT_FOUND',
          },
        };
      }
      case 'P2003': {
        // Foreign key constraint violation
        return {
          statusCode: 400,
          body: {
            error: 'Related record not found',
            code: 'VALIDATION_ERROR',
          },
        };
      }
      case 'P2014': {
        // Relation violation
        return {
          statusCode: 400,
          body: {
            error: 'Invalid relation change',
            code: 'VALIDATION_ERROR',
          },
        };
      }
      default:
        break;
    }
  }

  // Handle Prisma connection / database-unavailable errors → 503
  if (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P1001'
  ) {
    return {
      statusCode: 503,
      body: {
        error: 'Database is not available. Please ensure PostgreSQL is running and configured.',
        code: 'DATABASE_UNAVAILABLE',
      },
    };
  }

  // Handle standard JS errors (including generic connection failures)
  if (error instanceof Error) {
    const msg = error.message ?? '';
    const isConnectionError =
      /ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT|connect/i.test(msg) &&
      !msg.includes('CORS');
    if (isConnectionError && msg.length < 300) {
      return {
        statusCode: 503,
        body: {
          error: 'Database is not available. Please ensure PostgreSQL is running and configured.',
          code: 'DATABASE_UNAVAILABLE',
        },
      };
    }
    const message = sanitizeMessage(msg);
    return {
      statusCode: 500,
      body: {
        error: process.env.NODE_ENV === 'development' ? message : 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    };
  }

  // Fallback for unknown error types
  return {
    statusCode: 500,
    body: {
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    },
  };
}
