import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
  '/api/v1/system/health',
];

const PUBLIC_PAGE_PATHS = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/setup',
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
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');
  }
}

// ============================================
// MIDDLEWARE
// ============================================

export function middleware(request: NextRequest): NextResponse {
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
