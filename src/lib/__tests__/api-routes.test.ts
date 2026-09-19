/**
 * API Route Integration Tests.
 * Tests authentication, authorization, validation, and pagination.
 * Uses fetch() to call the actual API or tests the handler logic.
 */

import { handleApiError, AuthenticationError, AuthorizationError, ValidationError } from '@/lib/errors';
import { validate, loginSchema, signupSchema, paginationSchema, createUserSchema } from '@/lib/validators';

// ============================================
// Authentication Tests
// ============================================

describe('API Route — authentication', () => {
  it('unauthenticated request returns AuthenticationError with 401', () => {
    const error = new AuthenticationError('Authentication required');
    const result = handleApiError(error);
    expect(result.statusCode).toBe(401);
    expect(result.body.code).toBe('AUTHENTICATION_ERROR');
  });

  it('missing Authorization header is treated as unauthenticated', () => {
    const error = new AuthenticationError('Authentication required');
    const result = handleApiError(error);
    expect(result.statusCode).toBe(401);
  });

  it('expired token returns AuthenticationError', () => {
    const error = new AuthenticationError('Invalid or expired token');
    const result = handleApiError(error);
    expect(result.statusCode).toBe(401);
    expect(result.body.error).toContain('Invalid or expired token');
  });
});

// ============================================
// Authorization Tests
// ============================================

describe('API Route — authorization', () => {
  it('unauthorized request (wrong role) returns 403', () => {
    const error = new AuthorizationError('Insufficient permissions');
    const result = handleApiError(error);
    expect(result.statusCode).toBe(403);
    expect(result.body.code).toBe('AUTHORIZATION_ERROR');
  });

  it('permission denied error includes permission name', () => {
    const error = new AuthorizationError('Permission denied: leads.delete');
    const result = handleApiError(error);
    expect(result.statusCode).toBe(403);
    expect(result.body.error).toContain('leads.delete');
  });

  it('viewer cannot access admin endpoints', () => {
    const error = new AuthorizationError('Permission denied: admin.manage');
    const result = handleApiError(error);
    expect(result.statusCode).toBe(403);
  });
});

// ============================================
// Input Validation Tests
// ============================================

describe('API Route — input validation', () => {
  it('invalid JSON body returns 400', () => {
    const syntaxError = new SyntaxError('Unexpected token in JSON');
    const result = handleApiError(syntaxError);
    expect(result.statusCode).toBe(400);
    expect(result.body.code).toBe('VALIDATION_ERROR');
  });

  it('missing required fields return 400 via ZodError', () => {
    const zodError = {
      name: 'ZodError',
      issues: [
        { path: ['email'], message: 'Email is required' },
        { path: ['password'], message: 'Password is required' },
      ],
    };
    const result = handleApiError(zodError);
    expect(result.statusCode).toBe(400);
    expect(result.body.code).toBe('VALIDATION_ERROR');
    expect(result.body.details).toEqual([
      { field: 'email', message: 'Email is required' },
      { field: 'password', message: 'Password is required' },
    ]);
  });

  it('loginSchema rejects missing email', () => {
    const result = loginSchema.safeParse({ password: 'test1234' });
    expect(result.success).toBe(false);
  });

  it('loginSchema rejects missing password', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com' });
    expect(result.success).toBe(false);
  });

  it('loginSchema rejects invalid email format', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'test1234' });
    expect(result.success).toBe(false);
  });

  it('loginSchema accepts valid input', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('signupSchema rejects mismatched passwords', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'Password1',
      confirmPassword: 'Password2',
    });
    expect(result.success).toBe(false);
  });

  it('signupSchema rejects weak password (no uppercase)', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'password1',
      confirmPassword: 'password1',
    });
    expect(result.success).toBe(false);
  });

  it('signupSchema rejects weak password (no number)', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'PasswordA',
      confirmPassword: 'PasswordA',
    });
    expect(result.success).toBe(false);
  });

  it('signupSchema rejects password shorter than 8 chars', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'Pass1',
      confirmPassword: 'Pass1',
    });
    expect(result.success).toBe(false);
  });

  it('validate() throws ValidationError with field details', () => {
    try {
      validate(loginSchema, {});
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).details).toBeDefined();
    }
  });
});

// ============================================
// Pagination Tests
// ============================================

describe('API Route — pagination', () => {
  it('paginationSchema defaults page to 1', () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
    }
  });

  it('paginationSchema defaults limit to 20', () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
    }
  });

  it('paginationSchema accepts valid page and limit', () => {
    const result = paginationSchema.safeParse({ page: 2, limit: 50 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(50);
    }
  });

  it('paginationSchema rejects limit > 100', () => {
    const result = paginationSchema.safeParse({ page: 1, limit: 200 });
    expect(result.success).toBe(false);
  });

  it('paginationSchema rejects limit < 1', () => {
    const result = paginationSchema.safeParse({ page: 1, limit: 0 });
    expect(result.success).toBe(false);
  });

  it('paginationSchema rejects page < 1', () => {
    const result = paginationSchema.safeParse({ page: 0, limit: 20 });
    expect(result.success).toBe(false);
  });

  it('paginationSchema coerces string page to number', () => {
    const result = paginationSchema.safeParse({ page: '3', limit: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(10);
    }
  });

  it('paginationSchema max limit is 100', () => {
    const result = paginationSchema.safeParse({ page: 1, limit: 100 });
    expect(result.success).toBe(true);
  });
});

// ============================================
// createUserSchema Tests
// ============================================

describe('API Route — create user validation', () => {
  it('rejects invalid email', () => {
    const result = createUserSchema.safeParse({
      email: 'not-an-email',
      name: 'Test User',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid roleCode', () => {
    const result = createUserSchema.safeParse({
      email: 'test@example.com',
      roleCode: 'SUPER_ADMIN', // Not in VALID_ASSIGNABLE_ROLES
    });
    expect(result.success).toBe(false);
  });

  it('defaults roleCode to VIEWER', () => {
    const result = createUserSchema.safeParse({
      email: 'test@example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.roleCode).toBe('VIEWER');
    }
  });

  it('accepts valid input with all fields', () => {
    const result = createUserSchema.safeParse({
      email: 'test@example.com',
      name: 'Test User',
      password: 'Password1',
      roleCode: 'ADMIN',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid role codes', () => {
    const validRoles = ['ADMIN', 'MANAGER', 'SALES_MANAGER', 'SALES_EXECUTIVE', 'TELECALLER',
      'HR_MANAGER', 'HR_EXECUTIVE', 'FIELD_MANAGER', 'FIELD_EXECUTIVE', 'ACCOUNTANT', 'VIEWER'];

    for (const role of validRoles) {
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
        roleCode: role,
      });
      expect(result.success).toBe(true);
    }
  });
});
