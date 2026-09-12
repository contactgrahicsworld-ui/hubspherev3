/**
 * Revoke an ACTIVE device.
 * POST /api/v1/devices/:id/revoke
 *
 * Sets status to REVOKED, records revokedBy/revokedAt,
 * invalidates deviceToken, broadcasts via SSE.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { sseManager } from '@/lib/telecalling/sse-manager';

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
// POST /api/v1/devices/:id/revoke
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'devices.revoke', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    // Verify device exists, belongs to tenant, and is ACTIVE
    const device = await db.device.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        status: true,
        deviceName: true,
        deviceModel: true,
      },
    });

    if (!device) {
      throw new NotFoundError('Device not found');
    }

    if (device.status !== 'ACTIVE') {
      throw new ValidationError(`Device cannot be revoked (current status: ${device.status}). Device must be in ACTIVE status.`);
    }

    // Revoke the device — invalidate deviceToken
    const updated = await db.device.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokedBy: payload.userId,
        revokedAt: new Date(),
        deviceToken: null, // Invalidate token
      },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        deviceName: true,
        deviceModel: true,
        status: true,
        revokedBy: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Broadcast device status change via SSE (tenant-scoped)
    sseManager.broadcastToTenant(payload.tenantId, 'device.status_change', {
      deviceId: id,
      previousStatus: 'ACTIVE',
      newStatus: 'REVOKED',
      revokedBy: payload.userId,
      revokedAt: updated.revokedAt,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'device.revoke',
      targetType: 'Device',
      targetId: id,
      metadata: { previousStatus: 'ACTIVE', newStatus: 'REVOKED' },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(updated, 'Device revoked successfully'));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
