/**
 * Device by ID API
 * GET    /api/v1/devices/:id — Get device by ID
 * PATCH  /api/v1/devices/:id — Update device info
 * DELETE /api/v1/devices/:id — Revoke and delete device
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { validate } from '@/lib/validators';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const updateDeviceSchema = z.object({
  deviceName: z.string().max(200).optional(),
  deviceModel: z.string().max(200).optional(),
  osVersion: z.string().max(100).optional(),
  appVersion: z.string().max(50).optional(),
  simOperator: z.string().max(200).optional(),
  simCountry: z.string().max(10).optional(),
  phoneNumber: z.string().max(30).optional(),
  pushToken: z.string().max(500).optional(),
});

// ============================================
// SHARED HELPERS
// ============================================

const deviceSelect = {
  id: true,
  tenantId: true,
  userId: true,
  deviceName: true,
  deviceModel: true,
  osVersion: true,
  appVersion: true,
  simOperator: true,
  simCountry: true,
  phoneNumber: true,
  status: true,
  pushToken: true,
  lastHeartbeatAt: true,
  lastIpAddress: true,
  registeredAt: true,
  approvedAt: true,
  approvedBy: true,
  revokedAt: true,
  revokedBy: true,
  createdAt: true,
  updatedAt: true,
} as const;

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
// GET /api/v1/devices/:id
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'devices.view', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const device = await db.device.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: deviceSelect,
    });

    if (!device) {
      throw new NotFoundError('Device not found');
    }

    return NextResponse.json(success(device));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// PATCH /api/v1/devices/:id — Update device info
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'devices.update', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    // Verify device exists and belongs to tenant
    const existing = await db.device.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new NotFoundError('Device not found');
    }

    const body = await request.json();
    const data = validate(updateDeviceSchema, body);

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (data.deviceName !== undefined) updateData.deviceName = data.deviceName;
    if (data.deviceModel !== undefined) updateData.deviceModel = data.deviceModel;
    if (data.osVersion !== undefined) updateData.osVersion = data.osVersion;
    if (data.appVersion !== undefined) updateData.appVersion = data.appVersion;
    if (data.simOperator !== undefined) updateData.simOperator = data.simOperator;
    if (data.simCountry !== undefined) updateData.simCountry = data.simCountry;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
    if (data.pushToken !== undefined) updateData.pushToken = data.pushToken;

    const device = await db.device.update({
      where: { id },
      data: updateData,
      select: deviceSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'device.update',
      targetType: 'Device',
      targetId: id,
      metadata: { updatedFields: Object.keys(data) },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(device, 'Device updated successfully'));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// DELETE /api/v1/devices/:id — Revoke and delete device
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'devices.delete', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    // Verify device exists and belongs to tenant
    const existing = await db.device.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: { id: true, status: true, deviceToken: true },
    });

    if (!existing) {
      throw new NotFoundError('Device not found');
    }

    // Revoke first (invalidate token), then delete
    await db.device.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedBy: payload.userId,
        deviceToken: null,
      },
    });

    await db.device.delete({ where: { id } });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'device.delete',
      targetType: 'Device',
      targetId: id,
      metadata: { previousStatus: existing.status },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success({ id }, 'Device revoked and deleted successfully'));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
