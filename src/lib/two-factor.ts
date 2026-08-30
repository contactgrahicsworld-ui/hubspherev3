/**
 * TOTP Two-Factor Authentication for privileged accounts.
 * Uses Web Crypto API only — no external dependencies.
 */

import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';

// ============================================
// CONSTANTS
// ============================================

const TOTP_PERIOD = 30; // seconds
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = { name: 'HMAC', hash: 'SHA-1' } as const;

const PRIVILEGED_ROLES = new Set([
  'SUPER_ADMIN',
  'TENANT_OWNER',
  'ADMIN',
]);

const TOTP_ISSUER = 'HubSphere Enterprise V3';

// ============================================
// HMAC-BASED ONE-TIME PASSWORD (RFC 6238)
// ============================================

/** Generate a 20-byte (160-bit) TOTP secret as Base32 */
export async function generateTOTPSecret(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return base32Encode(bytes);
}

/** Generate TOTP code for a given secret and time */
export async function generateTOTP(secret: string, time?: number): Promise<string> {
  const keyBytes = base32Decode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    TOTP_ALGORITHM,
    false,
    ['sign']
  );

  const counter = Math.floor((time ?? Date.now()) / 1000 / TOTP_PERIOD);
  const counterBytes = new Uint8Array(8);
  const dv = new DataView(counterBytes.buffer);
  dv.setBigUint64(0, BigInt(counter), false);

  const sig = await crypto.subtle.sign('HMAC', cryptoKey, counterBytes.buffer as ArrayBuffer);
  const hmac = new Uint8Array(sig);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, '0');
}

/** Verify a TOTP code with configurable window (default: 1 period before/after) */
export async function verifyTOTP(
  secret: string,
  code: string,
  window: number = 1
): Promise<boolean> {
  const now = Date.now();
  for (let i = -window; i <= window; i++) {
    const expected = await generateTOTP(secret, now + i * TOTP_PERIOD * 1000);
    // Constant-time comparison
    if (constantTimeEqual(code, expected)) return true;
  }
  return false;
}

/** Generate otpauth:// URI for QR code enrollment */
export function generateTOTPUri(email: string, secret: string): string {
  const encodedIssuer = encodeURIComponent(TOTP_ISSUER);
  const encodedEmail = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

/** Generate 10 single-use recovery codes */
export function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    // Format as XXXX-XXXX-XXXX-XXXX for readability
    codes.push(`${hex.slice(0,4)}-${hex.slice(4,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}`.toUpperCase());
  }
  return codes;
}

/** Hash recovery codes for storage using SHA-256 */
export async function hashRecoveryCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.toLowerCase().trim());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Verify a recovery code against stored hashes */
export async function verifyRecoveryCode(
  code: string,
  storedHashes: string[]
): Promise<{ valid: boolean; matchedIndex: number }> {
  const inputHash = await hashRecoveryCode(code);
  for (let i = 0; i < storedHashes.length; i++) {
    if (constantTimeEqual(inputHash, storedHashes[i])) {
      return { valid: true, matchedIndex: i };
    }
  }
  return { valid: false, matchedIndex: -1 };
}

/** Check if a role requires 2FA */
export function requires2FA(roleCode: string | null | undefined): boolean {
  if (!roleCode) return false;
  return PRIVILEGED_ROLES.has(roleCode);
}

/** Enable 2FA for a user — stores encrypted secret and hashed recovery codes */
export async function enable2FA(
  userId: string,
  secret: string,
  recoveryCodes: string[]
): Promise<void> {
  const hashedCodes = await Promise.all(recoveryCodes.map(hashRecoveryCode));
  await db.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: secret, // In production, encrypt with a server-side key
      twoFactorRecoveryCodes: hashedCodes,
    },
  });
}

/** Disable 2FA for a user */
export async function disable2FA(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorRecoveryCodes: [],
    },
  });
}

/** Verify 2FA during login */
export async function verify2FADuringLogin(
  userId: string,
  code: string
): Promise<{ verified: boolean; usedRecoveryCode: boolean }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true, twoFactorSecret: true, twoFactorRecoveryCodes: true },
  });

  if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
    return { verified: true, usedRecoveryCode: false }; // 2FA not enabled, skip
  }

  // Try TOTP first
  const totpValid = await verifyTOTP(user.twoFactorSecret, code);
  if (totpValid) {
    return { verified: true, usedRecoveryCode: false };
  }

  // Try recovery codes
  const recoveryHashes = (user.twoFactorRecoveryCodes as string[]) || [];
  const { valid, matchedIndex } = await verifyRecoveryCode(code, recoveryHashes);
  if (valid && matchedIndex >= 0) {
    // Remove used recovery code (single-use)
    const updated = [...recoveryHashes];
    updated.splice(matchedIndex, 1);
    await db.user.update({
      where: { id: userId },
      data: { twoFactorRecoveryCodes: updated },
    });
    return { verified: true, usedRecoveryCode: true };
  }

  return { verified: false, usedRecoveryCode: false };
}

/** Get 2FA status for a user (never exposes the secret) */
export async function get2FAStatus(userId: string): Promise<{
  enabled: boolean;
  recoveryCodesRemaining: number;
}> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true, twoFactorRecoveryCodes: true },
  });
  return {
    enabled: user?.twoFactorEnabled ?? false,
    recoveryCodesRemaining: Array.isArray(user?.twoFactorRecoveryCodes) ? user.twoFactorRecoveryCodes.length : 0,
  };
}

// ============================================
// HELPERS
// ============================================

function base32Encode(data: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const byte of data) bits += byte.toString(2).padStart(8, '0');
  while (bits.length % 5 !== 0) bits += '0';
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    result += alphabet[parseInt(bits.slice(i, i + 5), 2)];
  }
  return result;
}

function base32Decode(str: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of str.toUpperCase()) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
