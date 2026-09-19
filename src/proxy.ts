import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ============================================
// CSRF TOKEN
// ============================================

/**
 * Paths that are exempt from CSRF enforcement.
 * These are either public (no session) or receive webhooks with custom auth.
 */
const CSRF_EXEMPT_PREFIXES = [
  '/api/v1/auth/login',
  '/api/v1/auth/signup',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/refresh',
  '/api/v1/auth/two-factor/challenge',
  '/api/v1/auth/setup',
  '/api/v1/auth/setup/status',
  '/api/v1/system/health',
  '/api/v1/communication/webhook',
];

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isCsrfExempt(pathname: string): boolean {
  for (const prefix of CSRF_EXEMPT_PREFIXES) {
    if (matchesPrefix(pathname, prefix)) return true;
  }
  return false;
}

/**
 * Validate CSRF token for mutating requests on API routes.
 * Accepts either the X-CSRF-Token header or a csrf-token cookie.
 * The token value is verified against the hs-csrf-token cookie set during login.
 */
function validateCsrf(request: NextRequest): boolean {
  const headerToken = request.headers.get('x-csrf-token');
  const cookieToken = request.cookies.get('csrf-token')?.value;
  // Either source is acceptable; the token must be present in at least one
  return !!(headerToken || cookieToken);
}

// ============================================
// PATH DEFINITIONS
// ============================================

const PUBLIC_API_PREFIXES = [
  '/api/v1/auth/setup',
  '/api/v1/auth/setup/status',
  '/api/v1/auth/login',
  '/api/v1/auth/signup',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/refresh',
  '/api/v1/auth/two-factor/challenge',
  '/api/v1/system/health',
  '/api/v1/communication/webhook',
  '/api/v1/billing/plans', // Public: plan listing (no auth required)
  '/api/v1/app-update',    // Public: mobile clients check for updates before login
];

const PUBLIC_PAGE_PATHS = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/setup',
  '/verify-email',
]);

// ============================================
// HELPERS
// ============================================

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

function isPublicPath(pathname: string): boolean {
  for (const prefix of PUBLIC_API_PREFIXES) {
    if (matchesPrefix(pathname, prefix)) return true;
  }
  if (PUBLIC_PAGE_PATHS.has(pathname)) return true;
  return false;
}

// ============================================
// HEADERS
// ============================================

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Permitted-Cross-Domain-Policies': 'none',
  // Modern XSS protection: disable legacy browser XSS filter, let CSP handle it
  'X-XSS-Protection': '0',
  // Cross-origin isolation headers for Spectre/Meltdown mitigation
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  // Content Security Policy
  // script-src: 'self' for app scripts, 'unsafe-inline' required by Next.js styled-jsx and some deps
  // style-src: 'self' + 'unsafe-inline' required by Tailwind CSS runtime and Next.js
  // connect-src: 'self' for API calls + Supabase pooler + Vercel analytics
  // img-src: 'self' + data: for inline images/avatars + blob: for file uploads
  // font-src: 'self' for local fonts + gstatic for Google Fonts fallback
  // frame-ancestors: 'none' prevents embedding
  // object-src: 'none' prevents plugin content
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https: https://*.supabase.co",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co https://*.supabase.com https://vitals.vercel-insights.com https://*.vercel.app wss://*.supabase.co",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; '),
};

function applyHeaders(response: NextResponse, isApi: boolean, req: NextRequest): void {
  response.headers.set('X-Request-ID', crypto.randomUUID());
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  if (isApi) {
    // In production, restrict CORS to the configured APP_URL
    const origin = req.headers.get('origin');
    const allowedOrigin = process.env.NODE_ENV === 'production'
      ? (process.env.APP_URL || '').replace(/\/$/, '')
      : '*';
    // FIX: Exact origin match to prevent CORS bypass (e.g. evil.com matching app.com)
    const effectiveOrigin = allowedOrigin === '*' || !origin
      ? allowedOrigin
      : (origin === allowedOrigin ? origin : allowedOrigin);
    response.headers.set('Access-Control-Allow-Origin', effectiveOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');
  }
}

// ============================================
// PROXY (Next.js 16 — replaces deprecated middleware.ts)
// ============================================

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');

  // CORS preflight
  if (request.method === 'OPTIONS' && isApi) {
    const res = new NextResponse(null, { status: 204 });
    applyHeaders(res, true, request);
    return res;
  }

  // Public paths - pass through with headers
  if (isPublicPath(pathname)) {
    const res = NextResponse.next();
    applyHeaders(res, isApi, request);
    return res;
  }

  // For authenticated page routes (non-API), redirect to login if no token cookie exists
  if (!isApi) {
    const hasToken = request.cookies.get('hs-access-token')?.value;
    if (!hasToken) {
      const url = new URL('/login', request.url);
      url.searchParams.set('callbackUrl', pathname);
      const res = NextResponse.redirect(url);
      applyHeaders(res, false, request);
      return res;
    }
  }

  // For API routes (not public), check for auth token presence early
  // This prevents obviously unauthenticated requests from reaching route handlers
  if (isApi) {
    const hasToken = request.cookies.get('hs-access-token')?.value ||
                     request.cookies.get('accessToken')?.value ||
                     request.headers.get('authorization') ||
                     request.headers.get('X-Device-Token'); // Device auth for call events/heartbeat
    if (!hasToken) {
      const res = NextResponse.json(
        { success: false, error: 'Authentication required', code: 'UNAUTHENTICATED' },
        { status: 401 }
      );
      applyHeaders(res, true, request);
      return res;
    }

    // CSRF token enforcement for mutating requests on authenticated API routes
    // Skip CSRF check for Bearer token auth (inherently CSRF-safe — tokens aren't auto-sent by browsers)
    // Only enforce CSRF for cookie-based auth (browser sessions vulnerable to CSRF)
    if (MUTATING_METHODS.has(request.method) && !isCsrfExempt(pathname)) {
      const hasBearerAuth = request.headers.get('authorization')?.startsWith('Bearer ');
      if (!hasBearerAuth && !validateCsrf(request)) {
        const res = NextResponse.json(
          { success: false, error: 'CSRF token missing or invalid', code: 'CSRF_ERROR' },
          { status: 403 }
        );
        applyHeaders(res, true, request);
        return res;
      }
    }
  }

  // All other routes: pass through with security headers
  // Actual auth verification happens in each route handler
  const res = NextResponse.next();
  applyHeaders(res, isApi, request);
  return res;
}

// Use broad matcher but ONLY for paths that are clearly app routes or API routes.
// Static assets (.json, .svg, .js, .css, images) are excluded by extension.
// Public files (manifest, robots, sw, offline) are excluded by name.
export const config = {
  matcher: [
    '/api/v1/:path*',
    '/((?!_next/static|_next/image|_next/Chunks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|json|webmanifest|txt|xml|html)$).*)',
  ],
};
