/**
 * JWT authentication library using Web Crypto API.
 * No external dependencies for crypto operations.
 */

import { env } from '@/lib/env';

// ============================================
// TYPES
// ============================================

export interface JWTPayload {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  tenantId?: string;
  roleCode?: string;
  iat: number;
  exp: number;
}

// ============================================
// ENCODING HELPERS
// ============================================

/** Base64URL encode a Uint8Array */
function base64UrlEncode(buffer: Uint8Array): string {
  const binary = Array.from(buffer)
    .map((byte) => String.fromCharCode(byte))
    .join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Base64URL decode to Uint8Array */
function base64UrlDecode(str: string): Uint8Array {
  // Restore standard Base64 padding
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Convert a string to Uint8Array */
function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

// ============================================
// HMAC-SHA256 HELPERS
// ============================================

/** Import a secret key for HMAC-SHA256 */
async function importHmacKey(secret: string): Promise<CryptoKey> {
  const keyData = textToBytes(secret);
  return crypto.subtle.importKey(
    'raw',
    keyData.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/** Sign data with HMAC-SHA256 and return Base64URL signature */
async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    (textToBytes(data)).buffer as ArrayBuffer
  );
  return base64UrlEncode(new Uint8Array(signature));
}

/** Verify HMAC-SHA256 signature */
async function hmacVerify(
  secret: string,
  data: string,
  signature: string
): Promise<boolean> {
  try {
    const key = await importHmacKey(secret);
    const signatureBytes = base64UrlDecode(signature);
    return crypto.subtle.verify(
      'HMAC',
      key,
      (signatureBytes).buffer as ArrayBuffer,
      (textToBytes(data)).buffer as ArrayBuffer
    );
  } catch {
    return false;
  }
}

// ============================================
// JWT IMPLEMENTATION
// ============================================

/**
 * Create a JWT token (HS256) from a payload.
 * Adds iat (issued at) and exp (expiration) claims.
 */
async function createJWT(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  expiresInMs: number,
  secret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + Math.floor(expiresInMs / 1000),
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(textToBytes(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(textToBytes(JSON.stringify(fullPayload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await hmacSign(secret, signingInput);

  return `${signingInput}.${signature}`;
}

/**
 * Verify and decode a JWT token (HS256).
 * Returns the decoded payload or null if invalid/expired.
 */
async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    // Verify signature
    const valid = await hmacVerify(secret, signingInput, signature);
    if (!valid) {
      return null;
    }

    // Decode header and verify algorithm
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedHeader)));
    if (header.alg !== 'HS256') {
      return null;
    }

    // Decode payload
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload))) as JWTPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ============================================
// PASSWORD HASHING (Web Crypto: PBKDF2-SHA256)
// ============================================

/**
 * Hash a password using PBKDF2 with SHA-256.
 * Format: `pbkdf2:iterations:saltBase64:hashBase64`
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iterations = 100_000; // OWASP recommended minimum

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(plain),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 256-bit output
  );

  const hash = new Uint8Array(derivedBits);
  return `pbkdf2:${iterations}:${btoa(String.fromCharCode(...salt))}:${btoa(String.fromCharCode(...hash))}`;
}

/**
 * Verify a plain-text password against a stored hash.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    const parts = hash.split(':');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
      return false;
    }

    const iterations = parseInt(parts[1], 10);
    if (isNaN(iterations) || iterations <= 0) {
      return false;
    }

    const salt = Uint8Array.from(atob(parts[2]), (char) => char.charCodeAt(0));
    const storedHash = Uint8Array.from(atob(parts[3]), (char) => char.charCodeAt(0));

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(plain),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    const computedHash = new Uint8Array(derivedBits);

    // Constant-time comparison
    if (storedHash.length !== computedHash.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < storedHash.length; i++) {
      result |= storedHash[i] ^ computedHash[i];
    }
    return result === 0;
  } catch {
    return false;
  }
}

// ============================================
// TOKEN GENERATION
// ============================================

/**
 * Generate an access token (JWT, 15-minute expiry).
 */
export async function generateAccessToken(payload: {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  tenantId?: string;
  roleCode?: string;
}): Promise<string> {
  return createJWT(payload, 15 * 60 * 1000, env.JWT_SECRET);
}

/**
 * Generate a cryptographically random refresh token (64-byte hex string).
 */
export async function generateRefreshToken(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(64));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify an access token and return its decoded payload.
 * Returns null if the token is invalid, expired, or malformed.
 */
export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  return verifyJWT(token, env.JWT_SECRET);
}

/**
 * Verify a refresh token's HMAC signature using the refresh secret.
 * Note: Refresh tokens are raw hex strings stored in the DB.
 * This verifies a token against an expected value.
 */
export async function verifyRefreshToken(
  token: string,
  expectedToken: string
): Promise<boolean> {
  // Constant-time comparison
  if (token.length !== expectedToken.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }
  return result === 0;
}

// ============================================
// CSRF PROTECTION
// ============================================

/**
 * Verify a CSRF token using constant-time string comparison.
 */
export function verifyCsrfToken(csrf: string, expected: string): boolean {
  if (csrf.length !== expected.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < csrf.length; i++) {
    result |= csrf.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}

// ============================================
// TOKEN EXPIRY HELPERS
// ============================================

/** Days until refresh token expires */
export const REFRESH_TOKEN_EXPIRY_DAYS = 30;

/** Compute a Date for refresh token expiration */
export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}
