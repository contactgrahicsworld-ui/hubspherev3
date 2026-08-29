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
import { Prisma } from '@prisma/client';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const initiateCallSchema = z.object({
  to: z.string().trim().min(1, 'Recipient phone number is required'),
  from: z.string().trim().optional(),
  leadId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
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
// POST /api/v1/crm/calls/initiate — Initiate outbound call
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'calls.create', payload.tenantId);

    const body = await request.json();
    const data = validate(initiateCallSchema, body);

    // 1. Check for a TelephonyProvider in the registry
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

    // 2. Create the Call record — NEVER fake a successful call
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
        } as unknown as Prisma.InputJsonValue,
      },
      select: callSelect,
    });

    // 3. If call was initiated and recording provider exists, auto-start recording
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
          // but we should note it
          await db.call.update({
            where: { id: call.id },
            data: {
              recordingStatus: 'FAILED',
            },
          });
        }
      }
    }

    // 4. Re-fetch call to get the latest state (including recording updates)
    const finalCall = await db.call.findUnique({
      where: { id: call.id },
      select: callSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'call.initiate',
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
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(finalCall, callStatus === 'FAILED' ? 'Call initiation failed' : 'Call initiated'),
      { status: callStatus === 'FAILED' ? 200 : 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
