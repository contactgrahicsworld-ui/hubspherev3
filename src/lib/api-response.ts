/**
 * Standardized API response helpers.
 * All API routes should use these for consistent response format.
 */

export function success<T>(data: T, message?: string) {
  const response: {
    success: true;
    data: T;
    message?: string;
  } = { success: true, data };
  if (message) {
    response.message = message;
  }
  return response;
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export function error(
  message: string,
  code: string,
  statusCode?: number
) {
  return {
    success: false as const,
    error: message,
    code,
  };
}

// ============================================
// CACHE CONTROL HELPERS
// ============================================

/**
 * Common Cache-Control directives for API responses.
 * Use these in NextResponse.json() options: { headers: cache.private60 }
 */
export const cache = {
  /** Private cache, 60 seconds — for feature flags, user preferences */
  private60: { 'Cache-Control': 'private, max-age=60' },
  /** Private cache, 300 seconds — for user permissions, roles */
  private300: { 'Cache-Control': 'private, max-age=300' },
  /** Public cache, 3600 seconds (1 hour) — for plans, static config */
  public3600: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
  /** No cache — for sensitive or frequently changing data */
  noStore: { 'Cache-Control': 'no-store' },
};
