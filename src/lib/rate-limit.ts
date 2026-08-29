/**
 * Simple in-memory rate limiter for authentication endpoints.
 * Uses a sliding window counter per IP address.
 * In production, replace with Redis-backed rate limiting for multi-instance deployments.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}

/**
 * Check if a request should be rate limited.
 * @param key - Unique key (typically IP address or IP+endpoint)
 * @param maxRequests - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns { limited: boolean, retryAfterMs: number }
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { limited: boolean; retryAfterMs: number } {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return {
      limited: true,
      retryAfterMs: entry.resetAt - now,
    };
  }

  entry.count++;
  return { limited: false, retryAfterMs: 0 };
}

/**
 * Get client IP from request headers.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
