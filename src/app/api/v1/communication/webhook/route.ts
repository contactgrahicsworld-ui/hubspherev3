import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { validate } from '@/lib/validators';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

// ============================================
// SCHEMAS
// ============================================

const webhookEventSchema = z.object({
  provider: z.string().trim().min(1, 'Provider is required'),
  messageId: z.string().min(1, 'Message ID is required'),
  eventType: z.enum(['SENT', 'DELIVERED', 'READ', 'FAILED']),
  statusCode: z.string().trim().optional(),
  responseData: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// VALID EVENT TYPES → MESSAGE FIELD MAPPINGS
// ============================================

type WebhookEventType = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

const EVENT_STATUS_MAP: Record<WebhookEventType, { status: string; timestampField: string }> = {
  SENT: { status: 'SENT', timestampField: 'sentAt' },
  DELIVERED: { status: 'DELIVERED', timestampField: 'deliveredAt' },
  READ: { status: 'READ', timestampField: 'readAt' },
  FAILED: { status: 'FAILED', timestampField: 'failedAt' },
};

// ============================================
// HELPERS
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
// POST /api/v1/communication/webhook — Provider delivery callback
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = validate(webhookEventSchema, body);

    // 1. Simple provider validation: check that a CommunicationProviderConfig
    //    exists for this provider (any tenant). This is a minimal signature check;
    //    production would use HMAC verification.
    const providerConfig = await db.communicationProviderConfig.findFirst({
      where: { provider: data.provider, isEnabled: true },
      select: { id: true, tenantId: true },
    });

    if (!providerConfig) {
      throw new ValidationError(
        `No active provider configuration found for: ${data.provider}`,
      );
    }

    // 2. Look up the message by externalMessageId or by id
    const message = await db.message.findFirst({
      where: {
        OR: [
          { id: data.messageId },
          { externalMessageId: data.messageId },
        ],
      },
      select: {
        id: true,
        tenantId: true,
        status: true,
        channel: true,
      },
    });

    if (!message) {
      // Acknowledge receipt but report message not found
      return NextResponse.json(
        success({ acknowledged: true, found: false }, 'Message not found'),
      );
    }

    const eventType = data.eventType as WebhookEventType;
    const mapping = EVENT_STATUS_MAP[eventType];
    const now = new Date();

    // 3. Create/update DeliveryAttempt record
    //    Find the most recent delivery attempt for this message
    const existingAttempt = await db.deliveryAttempt.findFirst({
      where: { messageId: message.id },
      orderBy: { attemptedAt: 'desc' },
      select: { id: true },
    });

    if (existingAttempt) {
      await db.deliveryAttempt.update({
        where: { id: existingAttempt.id },
        data: {
          status: eventType === 'FAILED' ? 'FAILED' : 'SUCCESS',
          statusCode: data.statusCode ?? null,
          response: data.responseData
            ? JSON.stringify(data.responseData)
            : undefined,
          completedAt: now,
        },
      });
    } else {
      // No existing attempt — create one
      await db.deliveryAttempt.create({
        data: {
          tenantId: message.tenantId,
          messageId: message.id,
          provider: data.provider,
          status: eventType === 'FAILED' ? 'FAILED' : 'SUCCESS',
          statusCode: data.statusCode ?? null,
          response: data.responseData
            ? JSON.stringify(data.responseData)
            : undefined,
          attemptedAt: now,
          completedAt: now,
        },
      });
    }

    // 4. Create MessageEvent record
    await db.messageEvent.create({
      data: {
        tenantId: message.tenantId,
        messageId: message.id,
        eventType,
        eventData: {
          provider: data.provider,
          statusCode: data.statusCode,
          responseData: data.responseData ?? null,
          webhookTimestamp: now.toISOString(),
        } as unknown as Prisma.InputJsonValue,
        source: 'webhook',
      },
    });

    // 5. Update Message status and appropriate timestamp
    const updateData: Record<string, unknown> = {
      status: mapping.status,
    };

    // Only set timestamps forward, never backward
    updateData[mapping.timestampField] = now;

    // For FAILED events, store the failure reason
    if (eventType === 'FAILED') {
      const responseData = data.responseData;
      const reason =
        (responseData && typeof responseData === 'object' && 'error' in responseData)
          ? String((responseData as Record<string, unknown>).error)
          : data.statusCode ?? 'UNKNOWN';
      updateData.failureReason = reason;
    }

    await db.message.update({
      where: { id: message.id },
      data: updateData as Prisma.MessageUpdateInput,
    });

    return NextResponse.json(
      success({ acknowledged: true, found: true, eventType, messageId: message.id }),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
