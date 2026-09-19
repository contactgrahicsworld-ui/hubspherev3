/**
 * Pre-configured rate limiters for common endpoint categories.
 * Built on top of the core rateLimit() function from rate-limit.ts.
 *
 * Usage in route handlers:
 *   import { authLimiter, checkRateLimit } from '@/lib/rate-limit-middleware';
 *   await checkRateLimit(request, authLimiter, 'login');
 */

import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { RateLimitError } from '@/lib/errors';
import type { NextRequest } from 'next/server';

// ============================================
// RATE LIMITER CONFIGURATIONS
// ============================================

export interface RateLimiterConfig {
  /** Max requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Human-readable label for error messages */
  label: string;
}

/**
 * Auth endpoints: 5 requests per minute.
 * Covers login, signup, forgot-password, reset-password.
 */
export const authLimiter: RateLimiterConfig = {
  maxRequests: 5,
  windowMs: 60 * 1000, // 1 minute
  label: 'auth',
};

/**
 * General API endpoints: 100 requests per minute.
 * Standard rate limit for most API routes.
 */
export const apiLimiter: RateLimiterConfig = {
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  label: 'api',
};

/**
 * AI endpoints: 20 requests per minute.
 * AI calls are expensive — stricter limit.
 */
export const aiLimiter: RateLimiterConfig = {
  maxRequests: 20,
  windowMs: 60 * 1000, // 1 minute
  label: 'ai',
};

/**
 * Billing endpoints: 10 requests per minute.
 * Billing changes are sensitive — stricter limit.
 */
export const billingLimiter: RateLimiterConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
  label: 'billing',
};

/**
 * Data export endpoints: 5 requests per minute.
 * Exports are resource-intensive — very strict limit.
 */
export const exportLimiter: RateLimiterConfig = {
  maxRequests: 5,
  windowMs: 60 * 1000, // 1 minute
  label: 'export',
};

// ============================================
// HELPER FUNCTION
// ============================================

/**
 * Check rate limit for a request using a pre-configured limiter.
 * Throws RateLimitError if the limit is exceeded.
 *
 * @param request - The incoming Next.js request
 * @param limiter - The rate limiter configuration to use
 * @param action - Specific action identifier (e.g., 'login', 'change-plan')
 * @throws RateLimitError if the rate limit is exceeded
 */
export async function checkRateLimit(
  request: NextRequest,
  limiter: RateLimiterConfig,
  action: string,
): Promise<void> {
  const key = `${getClientIp(request)}:${limiter.label}:${action}`;
  const { limited, retryAfterMs } = await rateLimit(key, limiter.maxRequests, limiter.windowMs);

  if (limited) {
    throw new RateLimitError(
      `Too many ${action} requests. Please try again later.`,
      Math.ceil(retryAfterMs / 1000),
    );
  }
}
