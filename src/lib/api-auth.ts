/**
 * API authentication helpers for route handlers.
 * Extracts and verifies JWT tokens from Authorization header or cookies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import type { JWTPayload } from '@/lib/auth';
import { AuthenticationError } from '@/lib/errors';

const ACCESS_TOKEN_COOKIE = 'hs-access-token';
const REFRESH_TOKEN_COOKIE = 'hs-refresh-token';

/**
 * Extract Bearer token from Authorization header, falling back to cookie.
 */
function extractAccessToken(request: NextRequest): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Fall back to cookie
  return request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

/**
 * Get the authenticated user from the request.
 * Throws AuthenticationError if not authenticated.
 */
export async function getAuthUser(request: NextRequest): Promise<JWTPayload> {
  const token = extractAccessToken(request);

  if (!token) {
    throw new AuthenticationError('Authentication required');
  }

  const payload = await verifyAccessToken(token);

  if (!payload) {
    throw new AuthenticationError('Invalid or expired token');
  }

  return payload;
}

/**
 * Get the authenticated user from the request, returning null if not authenticated.
 */
export async function getOptionalAuthUser(
  request: NextRequest
): Promise<JWTPayload | null> {
  const token = extractAccessToken(request);

  if (!token) {
    return null;
  }

  return verifyAccessToken(token);
}

/**
 * Set auth cookies on a response.
 */
export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
): void {
  const isSecure = process.env.NODE_ENV === 'production';

  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60, // 15 minutes
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
}

/**
 * Clear auth cookies on a response.
 */
export function clearAuthCookies(response: NextResponse): void {
  const isSecure = process.env.NODE_ENV === 'production';

  response.cookies.set(ACCESS_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
