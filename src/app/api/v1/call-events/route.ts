/**
 * Call Events API
 * GET  /api/v1/call-events — List call events for tenant/callRequest (paginated)
 * POST /api/v1/call-events — Create a call event (DUAL AUTH: X-Device-Token OR JWT)
 *
 * Auto-creates/updates CRM Call record based on event type:
 * - CALL_STARTED → create Call if not exists, update CallRequest.callId
 * - CONNECTED → update Call.callStatus = CONNECTED
 * - ENDED → update Call.callStatus = ENDED, set duration, callEndTime
 * - FAILED → update Call.callStatus = FAILED, set failureReason
 * - MISSED → update Call.callStatus = MISSED
 *
 * Broadcasts all events via SSE manager (tenant-scoped).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import { handleApiError, AuthenticationError, NotFoundError, ConflictError } from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { authenticateDevice } from '@/lib/telecalling/device-auth';
import { sseManager } from '@/lib/telecalling/sse-manager';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const CALL_EVENT_TYPES = [
  'CALL_STARTED',
  'RINGING',
  'CONNECTED',
  'ON_HOLD',
  'RESUMED',
  'ENDED',
  'FAILED',
  'MISSED',
] as const;

const createCallEventSchema = z.object({
  callRequestId: z.string().uuid('Call request ID must be a valid UUID'),
  eventType: z.enum(CALL_EVENT_TYPES),
  eventId: z.string().min(1, 'Event ID is required for idempotency').max(200),
  duration: z.number().int().min(0).optional(),
  failureReason: z.string().max(500).optional(),
  recordingAvailable: z.boolean().optional(),
  recordingUrl: z.string().max(2000).optional(),
  eventData: z.record(z.string(), z.unknown()).optional(),
});

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

/**
 * Auto-create or update the CRM Call record based on call event type.
 * Returns the call ID.
 */
async function handleCallRecordUpdate(
  eventType: string,
  callRequest: {
    id: string;
    tenantId: string;
    callId: string | null;
    leadId: string | null;
    contactId: string | null;
    dealId: string | null;
    deviceId: string;
  },
  deviceUserId: string,
  eventPayload: {
    duration?: number;
    failureReason?: string;
  }
): Promise<string | null> {
  let callId = callRequest.callId;

  switch (eventType) {
    case 'CALL_STARTED': {
      // Create a new Call record if one doesn't exist
      if (!callId) {
        const call = await db.call.create({
          data: {
            tenantId: callRequest.tenantId,
            leadId: callRequest.leadId,
            contactId: callRequest.contactId,
            dealId: callRequest.dealId,
            agentId: deviceUserId,
            direction: 'OUTBOUND',
            callType: 'PSTN',
            callStatus: 'RINGING',
            callStartTime: new Date(),
            recordingStatus: 'NOT_AVAILABLE',
          },
          select: { id: true },
        });
        callId = call.id;

        // Link the Call to the CallRequest
        await db.callRequest.update({
          where: { id: callRequest.id },
          data: { callId },
        });
      } else {
        // Call already exists — update start time
        await db.call.update({
          where: { id: callId },
          data: {
            callStatus: 'RINGING',
            callStartTime: new Date(),
          },
        });
      }
      break;
    }

    case 'CONNECTED': {
      if (callId) {
        await db.call.update({
          where: { id: callId },
          data: { callStatus: 'CONNECTED' },
        });
      }
      break;
    }

    case 'ENDED': {
      if (callId) {
        await db.call.update({
          where: { id: callId },
          data: {
            callStatus: 'ENDED',
            callEndTime: new Date(),
            duration: eventPayload.duration ?? null,
          },
        });
      }
      // Also update call request to COMPLETED
      await db.callRequest.update({
        where: { id: callRequest.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      break;
    }

    case 'FAILED': {
      if (callId) {
        await db.call.update({
          where: { id: callId },
          data: {
            callStatus: 'FAILED',
            callEndTime: new Date(),
            failureReason: eventPayload.failureReason ?? null,
          },
        });
      }
      // Also update call request to COMPLETED
      await db.callRequest.update({
        where: { id: callRequest.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      break;
    }

    case 'MISSED': {
      if (callId) {
        await db.call.update({
          where: { id: callId },
          data: {
            callStatus: 'MISSED',
            callEndTime: new Date(),
          },
        });
      }
      // Also update call request to COMPLETED
      await db.callRequest.update({
        where: { id: callRequest.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      break;
    }

    case 'RINGING':
    case 'ON_HOLD':
    case 'RESUMED': {
      // For these intermediate events, no CRM Call update needed
      // The event itself is recorded in CallEvent
      break;
    }
  }

  return callId;
}

// ============================================
// GET /api/v1/call-events — List call events
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'call_events.view', payload.tenantId, payload.isSuperAdmin);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const callRequestId = searchParams.get('callRequestId');
    const deviceId = searchParams.get('deviceId');
    const eventType = searchParams.get('eventType');

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    if (callRequestId) where.callRequestId = callRequestId;
    if (deviceId) where.deviceId = deviceId;
    if (eventType) where.eventType = eventType;

    const [callEvents, total] = await Promise.all([
      db.callEvent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: callEventSelect,
      }),
      db.callEvent.count({ where }),
    ]);

    return NextResponse.json(paginated(callEvents, total, page, limit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/call-events — Create call event (DUAL AUTH)
// ============================================

export async function POST(request: NextRequest) {
  try {
    // DUAL AUTH: Try device token first, then fall back to JWT
    const deviceTokenHeader = request.headers.get('x-device-token');
    let tenantId: string;
    let deviceId: string;
    let actorId: string;
    let deviceUserId: string;
    let authMethod: string;

    if (deviceTokenHeader) {
      // Device auth via X-Device-Token
      const deviceAuth = await authenticateDevice(request);
      tenantId = deviceAuth.tenantId;
      deviceId = deviceAuth.deviceId;
      actorId = deviceAuth.deviceId;
      deviceUserId = deviceAuth.userId;
      authMethod = 'device_token';
    } else {
      // JWT auth
      const payload = await getAuthUser(request);

      if (!payload.tenantId) {
        throw new AuthenticationError('Tenant context required');
      }

      await requirePermission(payload.roleCode ?? null, 'call_events.create', payload.tenantId, payload.isSuperAdmin);

      tenantId = payload.tenantId;
      deviceId = ''; // Will be set from call request
      actorId = payload.userId;
      deviceUserId = payload.userId;
      authMethod = 'jwt';
    }

    const body = await request.json();
    const data = validate(createCallEventSchema, body);

    // Verify the call request exists and belongs to this tenant
    const callRequest = await db.callRequest.findFirst({
      where: { id: data.callRequestId, tenantId },
      select: {
        id: true,
        tenantId: true,
        callId: true,
        leadId: true,
        contactId: true,
        dealId: true,
        deviceId: true,
        status: true,
      },
    });

    if (!callRequest) {
      throw new NotFoundError('Call request not found');
    }

    // If JWT auth, use the device ID from the call request
    if (authMethod === 'jwt') {
      deviceId = callRequest.deviceId;
    }

    // Idempotency check: if event with this eventId already exists, return it
    const existingEvent = await db.callEvent.findUnique({
      where: { eventId: data.eventId },
      select: callEventSelect,
    });

    if (existingEvent) {
      return NextResponse.json(success(existingEvent, 'Call event already exists (idempotent)'));
    }

    // Create the call event
    const callEvent = await db.callEvent.create({
      data: {
        tenantId,
        callRequestId: data.callRequestId,
        deviceId,
        eventType: data.eventType,
        eventId: data.eventId,
        duration: data.duration ?? null,
        failureReason: data.failureReason ?? null,
        recordingAvailable: data.recordingAvailable ?? false,
        recordingUrl: data.recordingUrl ?? null,
        eventData: (data.eventData ?? {}) as any,
      },
      select: callEventSelect,
    });

    // Auto-create/update CRM Call record based on event type
    const callId = await handleCallRecordUpdate(
      data.eventType,
      callRequest,
      deviceUserId,
      {
        duration: data.duration,
        failureReason: data.failureReason,
      }
    );

    // Broadcast call event via SSE (tenant-scoped)
    sseManager.broadcastToTenant(tenantId, 'call_event.created', {
      id: callEvent.id,
      callRequestId: data.callRequestId,
      deviceId,
      eventType: data.eventType,
      callId,
      duration: data.duration,
      failureReason: data.failureReason,
      createdAt: callEvent.createdAt,
    });

    await createAuditLog({
      actorId,
      tenantId,
      action: `call_event.${data.eventType.toLowerCase()}`,
      targetType: 'CallEvent',
      targetId: callEvent.id,
      metadata: {
        callRequestId: data.callRequestId,
        eventType: data.eventType,
        authMethod,
        callId,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success({ ...callEvent, callId }, 'Call event recorded successfully'),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
