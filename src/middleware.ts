import { NextRequest, NextResponse } from 'next/server';

// ============================================
// HubSphere V3 — Centralized Auth Middleware
// Enforces JWT auth on all /api/v1/* routes
// except explicitly public endpoints
// ============================================

// Public routes that do NOT require authentication
const PUBLIC_API_ROUTES = [
  '/api/v1/auth/login',
  '/api/v1/auth/signup',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/refresh',
  '/api/v1/auth/setup/status',
  '/api/v1/auth/setup',
  '/api/v1/system/health',
  '/api/v1/app-update',        // Mobile clients check updates before login
  '/api/v1/billing/plans',     // Public plan listing
  '/api/v1/communication/webhook', // Provider webhook (HMAC-verified separately)
];

// Routes that accept X-Device-Token as alternative auth
const DEVICE_AUTH_ROUTES = [
  '/api/v1/call-events',
  '/api/v1/devices',  // heartbeat sub-routes
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'));
}

function isDeviceAuthRoute(pathname: string): boolean {
  return DEVICE_AUTH_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // For device-auth routes, check for X-Device-Token header
  // If present, let the route handler validate it
  const deviceToken = request.headers.get('X-Device-Token');
  if (isDeviceAuthRoute(pathname) && deviceToken) {
    return NextResponse.next();
  }

  // For all other protected routes, check for JWT
  // Check Authorization header or access token cookie
  const authHeader = request.headers.get('Authorization');
  const accessToken = request.cookies.get('hs-access-token')?.value;

  if (!authHeader && !accessToken) {
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
      },
      { status: 401 }
    );
  }

  // Token validation is done by individual route handlers
  // This middleware only ensures a token is PRESENT
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/v1/:path*',
  ],
};
