/**
 * Device authentication helper for telecalling system.
 * Validates X-Device-Token header by looking up the device in DB
 * and checking it's ACTIVE. Used in call-events POST and heartbeat.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { AuthenticationError } from '@/lib/errors';

export interface DeviceAuthResult {
  deviceId: string;
  tenantId: string;
  userId: string;
  deviceName: string | null;
  deviceModel: string | null;
}

/**
 * Authenticate a device via X-Device-Token header.
 * Returns device info if the token is valid and the device is ACTIVE.
 * Throws AuthenticationError if token is missing, invalid, or device is not ACTIVE.
 */
export async function authenticateDevice(request: NextRequest): Promise<DeviceAuthResult> {
  const deviceToken = request.headers.get('x-device-token');

  if (!deviceToken) {
    throw new AuthenticationError('Device token required (X-Device-Token header)');
  }

  const device = await db.device.findUnique({
    where: { deviceToken },
    select: {
      id: true,
      tenantId: true,
      userId: true,
      deviceName: true,
      deviceModel: true,
      status: true,
    },
  });

  if (!device) {
    throw new AuthenticationError('Invalid device token');
  }

  if (device.status !== 'ACTIVE') {
    throw new AuthenticationError(`Device is not active (status: ${device.status})`);
  }

  return {
    deviceId: device.id,
    tenantId: device.tenantId,
    userId: device.userId,
    deviceName: device.deviceName,
    deviceModel: device.deviceModel,
  };
}
