/**
 * Audit logging service.
 * Records actions for compliance and security review.
 * NEVER stores passwords, tokens, API keys, or secrets in metadata.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * Fields that must be stripped from any metadata before storage.
 */
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'apiSecret',
  'secret',
  'authorization',
  'cookie',
  'credentials',
  'privateKey',
  'accessKey',
  'sessionId',
  'csrfToken',
  'otp',
  'pin',
  'cvv',
  'cardNumber',
  'ssn',
];

/**
 * Recursively sanitize an object, removing any keys that match sensitive field names.
 */
export function sanitizeMetadata(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some(
      (field) => lowerKey.includes(field.toLowerCase())
    );

    if (isSensitive) {
      continue; // Skip sensitive fields entirely
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(
        value as Record<string, unknown>
      );
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => {
        if (item !== null && typeof item === 'object') {
          return sanitizeMetadata(item as Record<string, unknown>);
        }
        return item;
      });
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export interface CreateAuditLogParams {
  actorId?: string;
  tenantId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry.
 * Metadata is automatically sanitized to remove sensitive fields.
 */
export async function createAuditLog(
  params: CreateAuditLogParams
): Promise<void> {
  const safeMetadata = params.metadata
    ? sanitizeMetadata(params.metadata)
    : undefined;

  await db.auditLog.create({
    data: {
      actorId: params.actorId,
      tenantId: params.tenantId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: safeMetadata as unknown as Prisma.InputJsonValue | undefined,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });
}
