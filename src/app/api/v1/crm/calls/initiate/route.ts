import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  ValidationError,
} from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { providerRegistry } from '@/lib/providers/registry';
import type { TelephonyProvider, CallRecordingProvider } from '@/lib/providers/types';
import { sseManager } from '@/lib/telecalling/sse-manager';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';

// ============================================
// SCHEMAS
// ============================================

const initiateCallSchema = z.object({
  to: z.string().trim().min(1, 'Recipient phone number is required'),
  from: z.string().trim().optional(),
  leadId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  // DUAL MODE: Device SIM calling
  deviceId: z.string().uuid().optional(), // If provided, route call through this Android device's physical SIM
  contactName: z.string().optional(),
  // Mode preference
  mode: z.enum(['device', 'provider', 'auto']).default('auto'), // auto = try device first, fallback to provider
});

// ============================================
// HELPERS
// ============================================

const callSelect = {
  id: true,
  tenantId: true,
  leadId: true,
  contactId: true,
  dealId: true,
  agentId: true,
  direction: true,
  callType: true,
  callStartTime: true,
  callEndTime: true,
  duration: true,
  callStatus: true,
  recordingStatus: true,
  recordingUrl: true,
  recordingProvider: true,
  recordingSize: true,
  recordingMeta: true,
  failureReason: true,
  retryCount: true,
  lastRetryAt: true,
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
// POST /api/v1/crm/calls/initiate — Initiate outbound call (DUAL MODE)
// Mode: device → Create CallRequest for Android SIM
//       provider → Use telephony provider (Twilio/KrispCall)
//       auto → Try device first, fallback to provider
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'calls.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(initiateCallSchema, body);

    // ============================================
    // MODE 1: Device SIM calling
    // ============================================
    if (data.mode === 'device' || (data.mode === 'auto' && data.deviceId)) {
      // Validate device exists and is ACTIVE
      const device = await db.device.findFirst({
        where: {
          id: data.deviceId,
          tenantId: payload.tenantId,
          status: 'ACTIVE',
        },
      });

      if (!device && data.mode === 'device') {
        throw new ValidationError('Device not found or not active. Provide a valid active device ID.');
      }

      if (device) {
        // Create CallRequest for the Android device
        const idempotencyKey = crypto.randomUUID();
        const callRequest = await db.callRequest.create({
          data: {
            tenantId: payload.tenantId,
            deviceId: device.id,
            requestedBy: payload.userId,
            leadId: data.leadId ?? null,
            contactId: data.contactId ?? null,
            dealId: data.dealId ?? null,
            phoneNumber: data.to,
            contactName: data.contactName ?? null,
            idempotencyKey,
            status: 'PENDING',
            priority: 0,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min expiry
          },
        });

        // Create a placeholder Call record linked to the CallRequest
        const call = await db.call.create({
          data: {
            tenantId: payload.tenantId,
            leadId: data.leadId ?? null,
            contactId: data.contactId ?? null,
            dealId: data.dealId ?? null,
            agentId: payload.userId,
            direction: 'OUTBOUND',
            callType: 'PSTN', // Physical SIM = PSTN
            callStatus: 'RINGING',
            recordingStatus: 'NOT_AVAILABLE',
            recordingMeta: {
              to: data.to,
              from: data.from ?? null,
              mode: 'device',
              deviceId: device.id,
              deviceName: device.deviceName,
              callRequestId: callRequest.id,
            } as unknown as Prisma.InputJsonValue,
          },
          select: callSelect,
        });

        // Link Call to CallRequest
        await db.callRequest.update({
          where: { id: callRequest.id },
          data: { callId: call.id },
        });

        // Broadcast to SSE — notify Android device and web clients
        sseManager.broadcastToTenant(payload.tenantId, 'call_request.created', {
          callRequestId: callRequest.id,
          deviceId: device.id,
          phoneNumber: data.to,
          contactName: data.contactName,
          callId: call.id,
          status: 'PENDING',
          expiresAt: callRequest.expiresAt,
        });

        await createAuditLog({
          actorId: payload.userId,
          tenantId: payload.tenantId,
          action: 'call.initiate_device',
          targetType: 'CallRequest',
          targetId: callRequest.id,
          metadata: {
            to: data.to,
            from: data.from ?? null,
            deviceId: device.id,
            callId: call.id,
            mode: 'device',
          },
          ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
          userAgent: request.headers.get('user-agent') ?? undefined,
        });

        return NextResponse.json(
          success({
            call,
            callRequest: {
              id: callRequest.id,
              status: callRequest.status,
              expiresAt: callRequest.expiresAt,
            },
            mode: 'device',
            message: 'Call request sent to device. Waiting for device to accept.',
          }, 'Call request sent to device'),
          { status: 201 },
        );
      }

      // Device not found in auto mode — fall through to provider
    }

    // ============================================
    // MODE 2: Telephony Provider (Twilio/KrispCall/VoIP)
    // ============================================
    const telephonyProvider = providerRegistry.getProvider('telephony');

    let callStatus: string;
    let failureReason: string | null = null;
    let providerCallId: string | null = null;
    let providerId: string | null = null;
    let recordingStatus: string = 'NOT_AVAILABLE';

    if (telephonyProvider) {
      // Provider available — attempt real call
      try {
        const tp = telephonyProvider as TelephonyProvider;
        const callResult = await tp.initiateCall(data.to, data.from);
        callStatus = callResult.status;
        providerCallId = callResult.callId;
        providerId = callResult.providerId;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown provider error';
        callStatus = 'FAILED';
        failureReason = errorMessage;
      }
    } else {
      // No provider configured
      callStatus = 'FAILED';
      failureReason = 'PROVIDER_NOT_CONFIGURED';
    }

    // Create the Call record — NEVER fake a successful call
    const call = await db.call.create({
      data: {
        tenantId: payload.tenantId,
        leadId: data.leadId ?? null,
        contactId: data.contactId ?? null,
        dealId: data.dealId ?? null,
        agentId: payload.userId,
        direction: 'OUTBOUND',
        callType: providerId ? 'VOIP' : null,
        callStartTime: callStatus !== 'FAILED' ? new Date() : null,
        callStatus,
        recordingStatus,
        failureReason,
        recordingMeta: {
          to: data.to,
          from: data.from ?? null,
          providerCallId: providerCallId,
          providerId,
          mode: 'provider',
        } as unknown as Prisma.InputJsonValue,
      },
      select: callSelect,
    });

    // If call was initiated and recording provider exists, auto-start recording
    if (callStatus !== 'FAILED' && providerCallId) {
      const recordingProvider = providerRegistry.getProvider('callRecording');
      if (recordingProvider) {
        try {
          const rp = recordingProvider as CallRecordingProvider;
          await rp.startRecording(providerCallId);
          await db.call.update({
            where: { id: call.id },
            data: {
              recordingStatus: 'RECORDING',
              recordingProvider: recordingProvider.getInfo().providerId,
            },
          });
        } catch (_err) {
          // Recording failure should not fail the call initiation response
          await db.call.update({
            where: { id: call.id },
            data: {
              recordingStatus: 'FAILED',
            },
          });
        }
      }
    }

    // Re-fetch call to get the latest state (including recording updates)
    const finalCall = await db.call.findUnique({
      where: { id: call.id },
      select: callSelect,
    });

    // Broadcast call status via SSE
    sseManager.broadcastToTenant(payload.tenantId, 'call_event.created', {
      callId: call.id,
      callStatus,
      providerId,
      mode: 'provider',
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'call.initiate_provider',
      targetType: 'Call',
      targetId: call.id,
      metadata: {
        to: data.to,
        from: data.from ?? null,
        leadId: data.leadId,
        contactId: data.contactId,
        dealId: data.dealId,
        callStatus,
        providerId,
        providerCallId,
        failureReason,
        mode: 'provider',
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success({
        ...finalCall,
        mode: 'provider',
      }, callStatus === 'FAILED' ? 'Call initiation failed' : 'Call initiated'),
      { status: callStatus === 'FAILED' ? 200 : 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
