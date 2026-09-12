/**
 * Devices API
 * GET  /api/v1/devices — List devices for tenant (paginated, filterable by status)
 * POST /api/v1/devices — Register a new device (creates in PAIRING status, generates pairingToken)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import crypto from 'crypto';

// ============================================
// SCHEMAS
// ============================================

const registerDeviceSchema = z.object({
  userId: z.string().uuid().optional(),
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
// GET /api/v1/devices — List devices
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'devices.view', payload.tenantId, payload.isSuperAdmin);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    if (status) where.status = status;
    if (userId) where.userId = userId;

    const [devices, total] = await Promise.all([
      db.device.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: deviceSelect,
      }),
      db.device.count({ where }),
    ]);

    return NextResponse.json(paginated(devices, total, page, limit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/devices — Register a new device
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'devices.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(registerDeviceSchema, body);

    // Generate pairing token with 15-minute expiry
    const pairingToken = crypto.randomBytes(32).toString('hex');
    const pairingTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const device = await db.device.create({
      data: {
        tenantId: payload.tenantId,
        userId: data.userId ?? payload.userId,
        deviceName: data.deviceName ?? null,
        deviceModel: data.deviceModel ?? null,
        osVersion: data.osVersion ?? null,
        appVersion: data.appVersion ?? null,
        simOperator: data.simOperator ?? null,
        simCountry: data.simCountry ?? null,
        phoneNumber: data.phoneNumber ?? null,
        pushToken: data.pushToken ?? null,
        status: 'PAIRING',
        pairingToken,
        pairingTokenExpiry,
        registeredAt: new Date(),
        metadata: {},
      },
      select: {
        ...deviceSelect,
        pairingToken: true,
        pairingTokenExpiry: true,
      },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'device.register',
      targetType: 'Device',
      targetId: device.id,
      metadata: { status: 'PAIRING', deviceName: data.deviceName, deviceModel: data.deviceModel },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(device, 'Device registered successfully'),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
