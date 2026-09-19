/**
 * Input Validation Tests.
 * Covers Zod schemas, HTML sanitization, UUID validation, email validation.
 */

import {
  validate,
  safeStringField,
  signupSchema,
  loginSchema,
  setupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  createTenantSchema,
  createUserSchema,
  createRoleSchema,
  updateFeatureFlagSchema,
  paginationSchema,
  VALID_ASSIGNABLE_ROLES,
} from '@/lib/validators';
import { ValidationError } from '@/lib/errors';
import { z } from 'zod';

// ============================================
// HTML Sanitization via safeStringField
// ============================================

describe('safeStringField — HTML sanitization', () => {
  it('strips HTML tags', () => {
    const schema = safeStringField(1, 500);
    const result = schema.safeParse('<b>Hello</b> World');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('Hello World');
    }
  });

  it('removes script tags and content', () => {
    const schema = safeStringField(1, 5000);
    const result = schema.safeParse('Hello <script>alert("xss")</script> World');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toContain('<script>');
      expect(result.data).not.toContain('alert');
      expect(result.data).toContain('Hello');
      expect(result.data).toContain('World');
    }
  });

  it('removes style tags and content', () => {
    const schema = safeStringField(1, 5000);
    const result = schema.safeParse('Hello <style>body{color:red}</style> World');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toContain('<style>');
      expect(result.data).toContain('Hello');
    }
  });

  it('removes all HTML tags', () => {
    const schema = safeStringField(1, 5000);
    const result = schema.safeParse('<div><p>Hello</p></div>');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('Hello');
    }
  });

  it('preserves plain text', () => {
    const schema = safeStringField(1, 500);
    const result = schema.safeParse('Hello World');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('Hello World');
    }
  });

  it('trims whitespace', () => {
    const schema = safeStringField(1, 500);
    const result = schema.safeParse('  Hello World  ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('Hello World');
    }
  });

  it('rejects empty string when min is 1', () => {
    const schema = safeStringField(1, 500);
    const result = schema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects string exceeding max length', () => {
    const schema = safeStringField(1, 10);
    const result = schema.safeParse('This is a very long string');
    expect(result.success).toBe(false);
  });

  it('handles XSS attribute injection', () => {
    const schema = safeStringField(1, 5000);
    const result = schema.safeParse('<img src=x onerror=alert(1)>');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toContain('onerror');
      expect(result.data).not.toContain('<img');
    }
  });

  it('handles nested script tags', () => {
    const schema = safeStringField(1, 5000);
    const result = schema.safeParse('<script><script>alert(1)</script></script>');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toContain('alert');
    }
  });
});

// ============================================
// Email Validation
// ============================================

describe('Email validation', () => {
  const emailSchema = z.string().trim().min(1).email();

  it('accepts valid email', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true);
  });

  it('accepts email with subdomain', () => {
    expect(emailSchema.safeParse('user@mail.example.com').success).toBe(true);
  });

  it('accepts email with plus sign', () => {
    expect(emailSchema.safeParse('user+tag@example.com').success).toBe(true);
  });

  it('accepts email with dash in domain', () => {
    expect(emailSchema.safeParse('user@my-domain.com').success).toBe(true);
  });

  it('rejects missing @ sign', () => {
    expect(emailSchema.safeParse('userexample.com').success).toBe(false);
  });

  it('rejects missing domain', () => {
    expect(emailSchema.safeParse('user@').success).toBe(false);
  });

  it('rejects missing local part', () => {
    expect(emailSchema.safeParse('@example.com').success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(emailSchema.safeParse('').success).toBe(false);
  });

  it('rejects spaces in email', () => {
    expect(emailSchema.safeParse('user @example.com').success).toBe(false);
  });

  it('trims whitespace before validation (via loginSchema)', () => {
    const result = loginSchema.safeParse({ email: '  user@example.com  ', password: 'password123' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
    }
  });
});

// ============================================
// UUID Validation (via Prisma/Zod)
// ============================================

describe('UUID validation', () => {
  const uuidSchema = z.string().uuid();

  it('accepts valid UUID v4', () => {
    expect(uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
  });

  it('rejects non-UUID string', () => {
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(uuidSchema.safeParse('').success).toBe(false);
  });

  it('rejects UUID with wrong format', () => {
    expect(uuidSchema.safeParse('550e8400-e29b-41d4-a716').success).toBe(false);
  });

  it('rejects numeric ID', () => {
    expect(uuidSchema.safeParse('12345').success).toBe(false);
  });
});

// ============================================
// signupSchema
// ============================================

describe('signupSchema', () => {
  it('accepts valid signup data', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'Password1',
      confirmPassword: 'Password1',
    });
    expect(result.success).toBe(true);
  });

  it('accepts signup with tenant name', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'Password1',
      confirmPassword: 'Password1',
      tenantName: 'My Company',
    });
    expect(result.success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'Password1',
      confirmPassword: 'Different1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects weak password without uppercase', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'password1',
      confirmPassword: 'password1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects weak password without lowercase', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'PASSWORD1',
      confirmPassword: 'PASSWORD1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects weak password without number', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'PasswordABC',
      confirmPassword: 'PasswordABC',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 chars', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'Pass1',
      confirmPassword: 'Pass1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = signupSchema.safeParse({
      email: 'not-an-email',
      password: 'Password1',
      confirmPassword: 'Password1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const result = signupSchema.safeParse({
      password: 'Password1',
      confirmPassword: 'Password1',
    });
    expect(result.success).toBe(false);
  });

  it('name is optional', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      password: 'Password1',
      confirmPassword: 'Password1',
    });
    expect(result.success).toBe(true);
  });
});

// ============================================
// loginSchema
// ============================================

describe('loginSchema', () => {
  it('accepts valid login', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'anypassword',
    });
    expect(result.success).toBe(true);
  });

  it('accepts login with device type', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'anypassword',
      deviceType: 'WEB',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing email', () => {
    const result = loginSchema.safeParse({ password: 'test' });
    expect(result.success).toBe(false);
  });

  it('rejects missing password', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid device type', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'test',
      deviceType: 'INVALID',
    });
    expect(result.success).toBe(false);
  });

  it('trims email whitespace', () => {
    const result = loginSchema.safeParse({
      email: '  test@example.com  ',
      password: 'test',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@example.com');
    }
  });
});

// ============================================
// createTenantSchema
// ============================================

describe('createTenantSchema', () => {
  it('accepts valid tenant data', () => {
    const result = createTenantSchema.safeParse({
      name: 'My Company',
      slug: 'my-company',
    });
    expect(result.success).toBe(true);
  });

  it('accepts tenant with domain', () => {
    const result = createTenantSchema.safeParse({
      name: 'My Company',
      slug: 'my-company',
      domain: 'mycompany.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid slug with uppercase', () => {
    const result = createTenantSchema.safeParse({
      name: 'My Company',
      slug: 'My-Company',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid slug with spaces', () => {
    const result = createTenantSchema.safeParse({
      name: 'My Company',
      slug: 'my company',
    });
    expect(result.success).toBe(false);
  });

  it('rejects slug with special characters', () => {
    const result = createTenantSchema.safeParse({
      name: 'My Company',
      slug: 'my_company!',
    });
    expect(result.success).toBe(false);
  });

  it('accepts slug with hyphens and numbers', () => {
    const result = createTenantSchema.safeParse({
      name: 'My Company',
      slug: 'my-company-123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createTenantSchema.safeParse({
      name: '',
      slug: 'my-company',
    });
    expect(result.success).toBe(false);
  });

  it('rejects name exceeding 200 chars', () => {
    const result = createTenantSchema.safeParse({
      name: 'x'.repeat(201),
      slug: 'my-company',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================
// createRoleSchema
// ============================================

describe('createRoleSchema', () => {
  it('accepts valid role data', () => {
    const result = createRoleSchema.safeParse({
      code: 'CUSTOM_ROLE',
      name: 'Custom Role',
    });
    expect(result.success).toBe(true);
  });

  it('rejects code with spaces', () => {
    const result = createRoleSchema.safeParse({
      code: 'custom role',
      name: 'Custom Role',
    });
    expect(result.success).toBe(false);
  });

  it('rejects code with hyphens', () => {
    const result = createRoleSchema.safeParse({
      code: 'custom-role',
      name: 'Custom Role',
    });
    expect(result.success).toBe(false);
  });

  it('accepts code with underscores', () => {
    const result = createRoleSchema.safeParse({
      code: 'CUSTOM_ROLE_1',
      name: 'Custom Role',
    });
    expect(result.success).toBe(true);
  });

  it('description is optional', () => {
    const result = createRoleSchema.safeParse({
      code: 'CUSTOM_ROLE',
      name: 'Custom Role',
    });
    expect(result.success).toBe(true);
  });

  it('permissions are optional', () => {
    const result = createRoleSchema.safeParse({
      code: 'CUSTOM_ROLE',
      name: 'Custom Role',
      permissions: ['leads.view', 'deals.view'],
    });
    expect(result.success).toBe(true);
  });
});

// ============================================
// changePasswordSchema
// ============================================

describe('changePasswordSchema', () => {
  it('accepts valid change password data', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPassword1',
      newPassword: 'NewPassword1',
      confirmPassword: 'NewPassword1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects mismatched new passwords', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPassword1',
      newPassword: 'NewPassword1',
      confirmPassword: 'Different1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects new password same as current', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'SamePassword1',
      newPassword: 'SamePassword1',
      confirmPassword: 'SamePassword1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects weak new password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPassword1',
      newPassword: 'weak',
      confirmPassword: 'weak',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================
// validate() helper function
// ============================================

describe('validate() helper', () => {
  it('returns parsed data for valid input', () => {
    const result = validate(loginSchema, {
      email: 'test@example.com',
      password: 'password',
    });
    expect(result.email).toBe('test@example.com');
    expect(result.password).toBe('password');
  });

  it('throws ValidationError for invalid input', () => {
    expect(() => validate(loginSchema, {})).toThrow(ValidationError);
  });

  it('throws ValidationError with field details', () => {
    try {
      validate(loginSchema, {});
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const details = (err as ValidationError).details as Array<{ field: string; message: string }>;
      expect(Array.isArray(details)).toBe(true);
      expect(details.length).toBeGreaterThan(0);
    }
  });

  it('includes field paths in error details', () => {
    try {
      validate(loginSchema, { email: 'invalid' });
    } catch (err) {
      const details = (err as ValidationError).details as Array<{ field: string; message: string }>;
      const fields = details.map(d => d.field);
      expect(fields).toContain('email');
    }
  });
});

// ============================================
// VALID_ASSIGNABLE_ROLES
// ============================================

describe('VALID_ASSIGNABLE_ROLES', () => {
  it('does not include SUPER_ADMIN', () => {
    expect(VALID_ASSIGNABLE_ROLES).not.toContain('SUPER_ADMIN');
  });

  it('does not include TENANT_OWNER', () => {
    expect(VALID_ASSIGNABLE_ROLES).not.toContain('TENANT_OWNER');
  });

  it('includes ADMIN', () => {
    expect(VALID_ASSIGNABLE_ROLES).toContain('ADMIN');
  });

  it('includes VIEWER', () => {
    expect(VALID_ASSIGNABLE_ROLES).toContain('VIEWER');
  });

  it('all roles are strings', () => {
    for (const role of VALID_ASSIGNABLE_ROLES) {
      expect(typeof role).toBe('string');
    }
  });
});

// ============================================
// Edge Cases
// ============================================

describe('Edge cases', () => {
  it('handles very long strings', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'P1' + 'a'.repeat(10000),
    });
    // Zod doesn't have max length on login password, so this should pass
    expect(result.success).toBe(true);
  });

  it('handles special characters in email', () => {
    const result = loginSchema.safeParse({
      email: 'user+tag@example.com',
      password: 'Password1',
    });
    expect(result.success).toBe(true);
  });

  it('handles null input to validate()', () => {
    expect(() => validate(loginSchema, null)).toThrow();
  });

  it('handles undefined input to validate()', () => {
    expect(() => validate(loginSchema, undefined)).toThrow();
  });

  it('handles string input instead of object', () => {
    expect(() => validate(loginSchema, 'not an object')).toThrow();
  });

  it('handles number input instead of object', () => {
    expect(() => validate(loginSchema, 42)).toThrow();
  });

  it('handles array input instead of object', () => {
    expect(() => validate(loginSchema, [])).toThrow();
  });

  it('safeStringField handles unicode characters', () => {
    const schema = safeStringField(1, 5000);
    const result = schema.safeParse('Hello 🎉 World');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toContain('🎉');
    }
  });

  it('safeStringField handles mixed content', () => {
    const schema = safeStringField(1, 5000);
    const result = schema.safeParse('Text <b>bold</b> more text <script>xss()</script> end');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toContain('<script>');
      expect(result.data).not.toContain('xss()');
      expect(result.data).toContain('Text');
      expect(result.data).toContain('bold');
    }
  });
});
