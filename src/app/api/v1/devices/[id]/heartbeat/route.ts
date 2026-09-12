/**
 * Device heartbeat endpoint.
 * POST /api/v1/devices/:id/heartbeat
 *
 * Accepts X-Device-Token header for device auth OR JWT for web auth.
 * Updates lastHeartbeatAt and lastIpAddress.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { authenticateDevice } from '@/lib/telecalling/device-auth';
import { validate } from '@/lib/validators';
import { z } from 'zod';

// ============================================
// SCHEMA
// ============================================

const heartbeatSchema = z.object({
  appVersion: z.string().max(50).optional(),
  pushToken: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// SHARED HELPERS
// ============================================

function isDbError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))
  );
}

function dbUnavailableResponse() {
  return NextResponse.json(
    { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
    { status: 503 },
  );
}

// ============================================
// POST /api/v1/devices/:id/heartbeat
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';

    // DUAL AUTH: Try device token first, then fall back to JWT
    const deviceToken = request.headers.get('x-device-token');
    let tenantId: string;
    let actorId: string;
    let authMethod: string;

    if (deviceToken) {
      // Device auth via X-Device-Token
      const deviceAuth = await authenticateDevice(request);

      // Verify the device ID in the URL matches the token
      if (deviceAuth.deviceId !== id) {
        throw new AuthenticationError('Device token does not match the requested device');
      }

      tenantId = deviceAuth.tenantId;
      actorId = deviceAuth.deviceId; // Use deviceId as actor for device auth
      authMethod = 'device_token';
    } else {
      // JWT auth
      const payload = await getAuthUser(request);

      if (!payload.tenantId) {
        throw new AuthenticationError('Tenant context required');
      }

      await requirePermission(payload.roleCode ?? null, 'devices.heartbeat', payload.tenantId, payload.isSuperAdmin);

      // Verify device belongs to tenant
      const device = await db.device.findFirst({
        where: { id, tenantId: payload.tenantId },
        select: { id: true },
      });

      if (!device) {
        throw new NotFoundError('Device not found');
      }

      tenantId = payload.tenantId;
      actorId = payload.userId;
      authMethod = 'jwt';
    }

    // Parse optional body
    let bodyData: Record<string, unknown> = {};
    try {
      const rawBody = await request.json();
      bodyData = validate(heartbeatSchema, rawBody) as Record<string, unknown>;
    } catch {
      // Empty body is acceptable for heartbeat
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      lastHeartbeatAt: new Date(),
      lastIpAddress: ipAddress,
    };
    if (bodyData.appVersion !== undefined) updateData.appVersion = bodyData.appVersion;
    if (bodyData.pushToken !== undefined) updateData.pushToken = bodyData.pushToken;
    if (bodyData.metadata !== undefined) updateData.metadata = bodyData.metadata;

    const updated = await db.device.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        status: true,
        lastHeartbeatAt: true,
        lastIpAddress: true,
        appVersion: true,
        updatedAt: true,
      },
    });

    await createAuditLog({
      actorId,
      tenantId,
      action: 'device.heartbeat',
      targetType: 'Device',
      targetId: id,
      metadata: { authMethod, ipAddress },
    });

    return NextResponse.json(success(updated, 'Heartbeat recorded'));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
