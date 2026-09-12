/**
 * Pair a device using pairingToken.
 * POST /api/v1/devices/:id/pair
 *
 * Validates the pairing token, sets status to PENDING_APPROVAL,
 * and generates a long-lived deviceToken (64-byte crypto.randomBytes hex).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, NotFoundError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { validate } from '@/lib/validators';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import crypto from 'crypto';

// ============================================
// SCHEMA
// ============================================

const pairDeviceSchema = z.object({
  pairingToken: z.string().min(1, 'Pairing token is required'),
  deviceName: z.string().max(200).optional(),
  deviceModel: z.string().max(200).optional(),
  osVersion: z.string().max(100).optional(),
  appVersion: z.string().max(50).optional(),
  simOperator: z.string().max(200).optional(),
  simCountry: z.string().max(10).optional(),
  phoneNumber: z.string().max(30).optional(),
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
// POST /api/v1/devices/:id/pair
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = validate(pairDeviceSchema, body);

    // Look up the device by ID and pairing token
    const device = await db.device.findFirst({
      where: {
        id,
        pairingToken: data.pairingToken,
      },
      select: {
        id: true,
        tenantId: true,
        status: true,
        pairingTokenExpiry: true,
      },
    });

    if (!device) {
      throw new NotFoundError('Device not found or invalid pairing token');
    }

    // Validate device is in PAIRING status
    if (device.status !== 'PAIRING') {
      throw new ValidationError(`Device cannot be paired (current status: ${device.status}). Device must be in PAIRING status.`);
    }

    // Validate pairing token has not expired
    if (!device.pairingTokenExpiry || device.pairingTokenExpiry < new Date()) {
      // Update device status to indicate expired
      await db.device.update({
        where: { id: device.id },
        data: { pairingToken: null, pairingTokenExpiry: null },
      });
      throw new ValidationError('Pairing token has expired. Please register the device again.');
    }

    // Generate long-lived device token (64-byte hex)
    const deviceToken = crypto.randomBytes(64).toString('hex');

    // Update device to PENDING_APPROVAL with new device token
    const updated = await db.device.update({
      where: { id: device.id },
      data: {
        status: 'PENDING_APPROVAL',
        deviceToken,
        pairingToken: null, // Clear pairing token (single use)
        pairingTokenExpiry: null,
        deviceName: data.deviceName ?? undefined,
        deviceModel: data.deviceModel ?? undefined,
        osVersion: data.osVersion ?? undefined,
        appVersion: data.appVersion ?? undefined,
        simOperator: data.simOperator ?? undefined,
        simCountry: data.simCountry ?? undefined,
        phoneNumber: data.phoneNumber ?? undefined,
      },
      select: {
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
        createdAt: true,
        updatedAt: true,
      },
    });

    await createAuditLog({
      tenantId: device.tenantId,
      action: 'device.pair',
      targetType: 'Device',
      targetId: device.id,
      metadata: { status: 'PENDING_APPROVAL', deviceModel: data.deviceModel },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success({
        device: updated,
        deviceToken, // Returned once — device must store it
      }, 'Device paired successfully. Awaiting approval.'),
      { status: 200 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
