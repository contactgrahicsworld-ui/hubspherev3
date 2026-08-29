import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, ValidationError, AuthenticationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { validate } from '@/lib/validators';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { isDatabaseConnected } from '@/lib/db';

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
// HMAC VERIFICATION
// ============================================

async function verifyWebhookSignature(
  request: NextRequest,
  providerName: string
): Promise<{ valid: boolean; tenantId: string | null }> {
  // Get the raw body for signature verification
  const rawBody = await request.text();
  const signature = request.headers.get('x-hubspot-signature')
    || request.headers.get('x-twilio-signature')
    || request.headers.get('whatsapp-webhook-signature')
    || '';

  if (!signature) {
    return { valid: false, tenantId: null };
  }

  // Look up provider config with webhook secret
  const providerConfig = await db.communicationProviderConfig.findFirst({
    where: { provider: providerName, isEnabled: true },
    select: { id: true, tenantId: true, config: true },
  });

  if (!providerConfig || !providerConfig.config) {
    return { valid: false, tenantId: null };
  }

  const config = providerConfig.config as Record<string, unknown>;
  const webhookSecret = config.webhookSecret as string | undefined;

  if (!webhookSecret) {
    // If no webhook secret is configured, reject the webhook
    return { valid: false, tenantId: null };
  }

  // Verify HMAC-SHA256 signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const expectedSig = `sha256=${Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;

  // Constant-time comparison
  const sigBytes = encoder.encode(signature);
  const expectedBytes = encoder.encode(expectedSig);
  let result = 0;
  const len = Math.max(sigBytes.length, expectedBytes.length);
  for (let i = 0; i < len; i++) {
    result |= (sigBytes[i] || 0) ^ (expectedBytes[i] || 0);
  }

  return { valid: result === 0, tenantId: providerConfig.tenantId };
}

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
    // Check database availability
    const dbConnected = await isDatabaseConnected();
    if (!dbConnected) {
      return dbUnavailableResponse();
    }

    const body = await request.json();
    const data = validate(webhookEventSchema, body);

    // Verify webhook signature
    const { valid, tenantId } = await verifyWebhookSignature(request, data.provider);
    if (!valid) {
      throw new AuthenticationError('Invalid or missing webhook signature. Configure a webhook secret for this provider.');
    }

    // Look up the message by externalMessageId or by id
    const message = await db.message.findFirst({
      where: {
        ...(tenantId ? { tenantId } : {}),
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
      return NextResponse.json(
        success({ acknowledged: true, found: false }, 'Message not found'),
      );
    }

    const eventType = data.eventType as WebhookEventType;
    const mapping = EVENT_STATUS_MAP[eventType];
    const now = new Date();

    // Create/update DeliveryAttempt record
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

    // Create MessageEvent record
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

    // Update Message status and appropriate timestamp
    const updateData: Record<string, unknown> = {
      status: mapping.status,
    };

    updateData[mapping.timestampField] = now;

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
