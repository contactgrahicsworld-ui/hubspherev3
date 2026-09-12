/**
 * Call Event by ID API
 * GET /api/v1/call-events/:id — Get call event by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, NotFoundError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';

// ============================================
// SHARED HELPERS
// ============================================

const callEventSelect = {
  id: true,
  tenantId: true,
  callRequestId: true,
  deviceId: true,
  eventType: true,
  eventData: true,
  eventId: true,
  duration: true,
  failureReason: true,
  recordingAvailable: true,
  recordingUrl: true,
  createdAt: true,
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
// GET /api/v1/call-events/:id
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

    await requirePermission(payload.roleCode ?? null, 'call_events.view', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const callEvent = await db.callEvent.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: callEventSelect,
    });

    if (!callEvent) {
      throw new NotFoundError('Call event not found');
    }

    return NextResponse.json(success(callEvent));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
