/**
 * Approve a PENDING_APPROVAL device.
 * POST /api/v1/devices/:id/approve
 *
 * Sets status to ACTIVE, records approvedBy/approvedAt,
 * broadcasts device.status_change event via SSE.
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
// POST /api/v1/devices/:id/approve
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

    await requirePermission(payload.roleCode ?? null, 'devices.approve', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    // Verify device exists, belongs to tenant, and is PENDING_APPROVAL
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

    if (device.status !== 'PENDING_APPROVAL') {
      throw new ValidationError(`Device cannot be approved (current status: ${device.status}). Device must be in PENDING_APPROVAL status.`);
    }

    // Approve the device
    const updated = await db.device.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        approvedBy: payload.userId,
        approvedAt: new Date(),
      },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        deviceName: true,
        deviceModel: true,
        status: true,
        approvedBy: true,
        approvedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Broadcast device status change via SSE (tenant-scoped)
    sseManager.broadcastToTenant(payload.tenantId, 'device.status_change', {
      deviceId: id,
      previousStatus: 'PENDING_APPROVAL',
      newStatus: 'ACTIVE',
      approvedBy: payload.userId,
      approvedAt: updated.approvedAt,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'device.approve',
      targetType: 'Device',
      targetId: id,
      metadata: { previousStatus: 'PENDING_APPROVAL', newStatus: 'ACTIVE' },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(updated, 'Device approved successfully'));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
