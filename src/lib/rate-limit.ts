/**
 * Database-backed distributed rate limiter for serverless/multi-instance deployments.
 * Falls back to in-memory if database is unavailable.
 * Uses a single RateLimitLog table for all rate limit tracking.
 */

import { db, isDatabaseConnected } from '@/lib/db';

// ============================================
// IN-MEMORY FALLBACK (for when DB is down)
// ============================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memStore = new Map<string, RateLimitEntry>();
const MEM_CLEANUP_INTERVAL = 5 * 60 * 1000;
let memLastCleanup = Date.now();

function memCleanup() {
  const now = Date.now();
  if (now - memLastCleanup < MEM_CLEANUP_INTERVAL) return;
  memLastCleanup = now;
  for (const [key, entry] of memStore) {
    if (now >= entry.resetAt) memStore.delete(key);
  }
}

function memRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { limited: boolean; retryAfterMs: number } {
  memCleanup();
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || now >= entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfterMs: 0 };
  }
  if (entry.count >= maxRequests) {
    return { limited: true, retryAfterMs: entry.resetAt - now };
  }
  entry.count++;
  return { limited: false, retryAfterMs: 0 };
}

// ============================================
// DATABASE-BACKED RATE LIMITING
// ============================================

/**
 * Check if a request should be rate limited.
 * Uses database for distributed accuracy, falls back to in-memory.
 *
 * @param key - Unique key (typically IP + endpoint)
 * @param maxRequests - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns { limited: boolean, retryAfterMs: number }
 */
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ limited: boolean; retryAfterMs: number }> {
  // Try database-backed rate limiting first
  try {
    const dbOk = await isDatabaseConnected();
    if (dbOk) {
      return await dbRateLimit(key, maxRequests, windowMs);
    }
  } catch {
    // Fall through to in-memory
  }

  // Fallback to in-memory
  return memRateLimit(key, maxRequests, windowMs);
}

async function dbRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ limited: boolean; retryAfterMs: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  // Hash the key to fit in a varchar field and for privacy
  const keyHash = await hashKey(key);

  // Count requests in the window
  const count = await db.auditLog.count({
    where: {
      action: 'rate_limit',
      targetType: keyHash.substring(0, 50),
      createdAt: { gte: windowStart },
    },
  });

  if (count >= maxRequests) {
    // Find the oldest record to calculate retry-after
    const oldest = await db.auditLog.findFirst({
      where: {
        action: 'rate_limit',
        targetType: keyHash.substring(0, 50),
        createdAt: { gte: windowStart },
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    const retryAfterMs = oldest
      ? Math.max(0, windowMs - (now.getTime() - oldest.createdAt.getTime()))
      : 0;
    return { limited: true, retryAfterMs };
  }

  // Record this request (fire-and-forget to not block the response)
  db.auditLog.create({
    data: {
      action: 'rate_limit',
      targetType: keyHash.substring(0, 50),
      metadata: { key: keyHash.substring(0, 16) },
    },
  }).catch((e) => { if (process.env.NODE_ENV === 'development') console.error('[RateLimit write failed]', e.message); });

  return { limited: false, retryAfterMs: 0 };
}

/** Hash a rate limit key for privacy and storage */
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get client IP from request headers.
 * Vercel sets x-forwarded-for with the real client IP first.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

// ============================================
// SYNC WRAPPER (for backward compatibility)
// ============================================

/**
 * Synchronous rate limit check (in-memory only, for non-critical paths).
 * @deprecated Use async rateLimit() for production endpoints.
 */
export function rateLimitSync(
  key: string,
  maxRequests: number,
  windowMs: number
): { limited: boolean; retryAfterMs: number } {
  return memRateLimit(key, maxRequests, windowMs);
}
