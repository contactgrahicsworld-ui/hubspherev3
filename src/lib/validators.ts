/**
 * Zod validation schemas for all API inputs.
 * Uses Zod v4 syntax.
 */

import { z } from 'zod';
import { ValidationError } from '@/lib/errors';

// ============================================
// HTML SANITIZATION
// ============================================

/**
 * Strip HTML tags and script content from a string to prevent stored XSS.
 * 1. Removes all content between <script>...</script> and <style>...</style> tags
 * 2. Removes all remaining HTML tags <...>
 * 3. Trims whitespace
 */
function stripHtmlTags(str: string): string {
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Create a sanitized string schema that strips HTML tags.
 * Usage: safeStringField(1, 200) creates z.string().trim().min(1).max(200).transform(stripHtmlTags)
 */
export function safeStringField(minLen?: number, maxLen: number = 5000) {
  let schema = z.string().trim();
  if (minLen !== undefined) schema = schema.min(minLen);
  schema = schema.max(maxLen);
  return schema.transform(stripHtmlTags);
}

// ============================================
// AUTH SCHEMAS
// ============================================

export const signupSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1, 'Email is required').email('Invalid email format'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Setup wizard — creates the first super admin. Mirrors signup but confirmPassword is optional at API level. */
export const setupSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1, 'Email is required').email('Invalid email format'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1).optional(),
  })
  .refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type SetupInput = z.infer<typeof setupSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Invalid email format'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ============================================
// TENANT SCHEMA
// ============================================

export const createTenantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(200, 'Name must be 200 characters or less'),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .max(100, 'Slug must be 100 characters or less')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  domain: z
    .string()
    .trim()
    .max(255, 'Domain must be 255 characters or less')
    .optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

// ============================================
// USER SCHEMA (admin creates user)
// ============================================

export const VALID_ASSIGNABLE_ROLES = [
  'ADMIN', 'MANAGER', 'SALES_MANAGER', 'SALES_EXECUTIVE', 'TELECALLER',
  'HR_MANAGER', 'HR_EXECUTIVE', 'FIELD_MANAGER', 'FIELD_EXECUTIVE',
  'ACCOUNTANT', 'VIEWER',
] as const;

export const createUserSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Invalid email format'),
  name: z
    .string()
    .trim()
    .min(1)
    .max(200, 'Name must be 200 characters or less')
    .optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .optional(),
  roleCode: z.enum(VALID_ASSIGNABLE_ROLES).default('VIEWER'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// ============================================
// ROLE SCHEMA
// ============================================

export const createRoleSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Code is required')
    .max(100, 'Code must be 100 characters or less')
    .regex(/^[a-zA-Z0-9_]+$/, 'Code must contain only alphanumeric characters and underscores'),
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(200, 'Name must be 200 characters or less'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must be 1000 characters or less')
    .optional(),
  permissions: z.array(z.string()).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

// ============================================
// FEATURE FLAG SCHEMA
// ============================================

export const updateFeatureFlagSchema = z.object({
  enabled: z.boolean(),
});

export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>;

// ============================================
// PAGINATION SCHEMA
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ============================================
// VALIDATE HELPER
// ============================================

/**
 * Validate unknown data against a Zod schema.
 * Throws ValidationError with detailed field errors on failure.
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ValidationError('Validation failed', details);
  }

  return result.data;
}
