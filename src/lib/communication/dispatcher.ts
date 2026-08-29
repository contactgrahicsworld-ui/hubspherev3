/**
 * Message Dispatcher Service
 * 
 * Dispatches messages through the appropriate provider from the registry.
 * Creates DeliveryAttempt and MessageEvent records for every dispatch.
 * NEVER fakes delivery — if a provider throws or isn't configured, the
 * message is marked FAILED.
 */

import { db } from '@/lib/db';
import { providerRegistry } from '@/lib/providers/registry';
import type { MessagingProvider } from '@/lib/providers/types';
import { Prisma } from '@prisma/client';

// ============================================
// CHANNEL → REGISTRY CATEGORY MAPPING
// ============================================

const CHANNEL_CATEGORY_MAP: Record<string, string> = {
  WHATSAPP: 'messaging',
  SMS: 'messaging',
  EMAIL: 'messaging',
  PUSH: 'notification',
};

// ============================================
// DISPATCH SINGLE MESSAGE
// ============================================

export interface DispatchResult {
  success: boolean;
  messageStatus: string;
  externalMessageId?: string;
  failureReason?: string;
  providerId?: string;
}

/**
 * Dispatch a single message through the appropriate provider.
 * 
 * 1. Looks up the message by ID + tenantId
 * 2. Finds the appropriate provider from the registry based on channel
 * 3. Dispatches via the provider
 * 4. Creates a DeliveryAttempt record
 * 5. Updates message status (SENT/FAILED)
 * 6. Creates a MessageEvent record
 */
export async function dispatchMessage(
  messageId: string,
  tenantId: string,
): Promise<DispatchResult> {
  // 1. Look up the message
  const message = await db.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      tenantId: true,
      conversationId: true,
      direction: true,
      channel: true,
      status: true,
      content: true,
      contentType: true,
      externalSenderId: true,
      metadata: true,
    },
  });

  if (!message || message.tenantId !== tenantId) {
    return {
      success: false,
      messageStatus: 'FAILED',
      failureReason: 'Message not found',
    };
  }

  // Only dispatch OUTBOUND messages that are still QUEUED
  if (message.direction !== 'OUTBOUND') {
    return {
      success: false,
      messageStatus: message.status,
      failureReason: 'Only OUTBOUND messages can be dispatched',
    };
  }

  if (message.status !== 'QUEUED') {
    return {
      success: false,
      messageStatus: message.status,
      failureReason: `Message is not in QUEUED state (current: ${message.status})`,
    };
  }

  // 2. Find the appropriate provider
  const category = CHANNEL_CATEGORY_MAP[message.channel];

  if (!category) {
    // Channel doesn't support dispatch (e.g. IN_APP, SYSTEM)
    await markMessageFailed(message.id, tenantId, 'PROVIDER_NOT_CONFIGURED', 'Channel does not support external dispatch');
    return {
      success: false,
      messageStatus: 'FAILED',
      failureReason: 'PROVIDER_NOT_CONFIGURED',
    };
  }

  const provider = providerRegistry.getProvider(category);

  if (!provider) {
    await markMessageFailed(message.id, tenantId, 'PROVIDER_NOT_CONFIGURED', `No provider configured for channel: ${message.channel}`);
    return {
      success: false,
      messageStatus: 'FAILED',
      failureReason: 'PROVIDER_NOT_CONFIGURED',
    };
  }

  // Determine the recipient from conversation participantIds or externalSenderId
  const recipient = resolveRecipient(message);
  if (!recipient) {
    await markMessageFailed(message.id, tenantId, 'NO_RECIPIENT', 'Could not determine message recipient');
    return {
      success: false,
      messageStatus: 'FAILED',
      failureReason: 'NO_RECIPIENT',
    };
  }

  // 3. Create a PENDING delivery attempt, then dispatch
  const channelLower = message.channel.toLowerCase() as 'whatsapp' | 'sms' | 'email';

  const deliveryAttempt = await db.deliveryAttempt.create({
    data: {
      tenantId,
      messageId: message.id,
      provider: provider.getInfo().providerId,
      status: 'PROCESSING',
      attemptedAt: new Date(),
    },
  });

  // 4. Dispatch via provider
  try {
    const messagingProvider = provider as MessagingProvider;
    const result = await messagingProvider.sendMessage(recipient, message.content, channelLower);

    // 5. Update delivery attempt to SUCCESS
    await db.deliveryAttempt.update({
      where: { id: deliveryAttempt.id },
      data: {
        status: 'SUCCESS',
        statusCode: '200',
        response: JSON.stringify({ providerMessageId: result.messageId }),
        completedAt: new Date(),
      },
    });

    // 6. Update message status to SENT
    await db.message.update({
      where: { id: message.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        externalMessageId: result.messageId,
      },
    });

    // 7. Create SENT event
    await db.messageEvent.create({
      data: {
        tenantId,
        messageId: message.id,
        eventType: 'SENT',
        eventData: {
          providerId: result.providerId,
          providerMessageId: result.messageId,
          deliveryAttemptId: deliveryAttempt.id,
        } as unknown as Prisma.InputJsonValue,
        source: 'dispatcher',
      },
    });

    return {
      success: true,
      messageStatus: 'SENT',
      externalMessageId: result.messageId,
      providerId: result.providerId,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown provider error';

    // Update delivery attempt to FAILED
    await db.deliveryAttempt.update({
      where: { id: deliveryAttempt.id },
      data: {
        status: 'FAILED',
        response: JSON.stringify({ error: errorMessage }),
        completedAt: new Date(),
      },
    });

    // Mark message as FAILED
    await markMessageFailed(message.id, tenantId, 'PROVIDER_ERROR', errorMessage);

    return {
      success: false,
      messageStatus: 'FAILED',
      failureReason: errorMessage,
    };
  }
}

// ============================================
// DISPATCH BULK (FUTURE CAMPAIGN SUPPORT)
// ============================================

export interface BulkDispatchResult {
  total: number;
  dispatched: number;
  failed: number;
  skipped: number;
  results: DispatchResult[];
}

/**
 * Dispatch messages in bulk for a campaign.
 * Processes each message individually so one failure doesn't block others.
 */
export async function dispatchBulk(
  messageIds: string[],
  tenantId: string,
): Promise<BulkDispatchResult> {
  const results: DispatchResult[] = [];
  let dispatched = 0;
  let failed = 0;
  let skipped = 0;

  // Process messages sequentially to avoid overwhelming providers
  for (const messageId of messageIds) {
    try {
      const result = await dispatchMessage(messageId, tenantId);
      results.push(result);

      if (result.success) {
        dispatched++;
      } else if (result.messageStatus === 'FAILED') {
        failed++;
      } else {
        skipped++;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      results.push({
        success: false,
        messageStatus: 'FAILED',
        failureReason: errorMessage,
      });
      failed++;
    }
  }

  return {
    total: messageIds.length,
    dispatched,
    failed,
    skipped,
    results,
  };
}

// ============================================
// HELPERS
// ============================================

/**
 * Mark a message as FAILED and create a FAILED event.
 */
async function markMessageFailed(
  messageId: string,
  tenantId: string,
  failureReason: string,
  detail: string,
): Promise<void> {
  await db.message.update({
    where: { id: messageId },
    data: {
      status: 'FAILED',
      failedAt: new Date(),
      failureReason,
    },
  });

  await db.messageEvent.create({
    data: {
      tenantId,
      messageId,
      eventType: 'FAILED',
      eventData: {
        failureReason,
        detail,
        source: 'dispatcher',
      } as unknown as Prisma.InputJsonValue,
      source: 'dispatcher',
    },
  });
}

/**
 * Resolve the recipient address from a message's conversation/metadata.
 * For WhatsApp/SMS this returns a phone number.
 * For EMAIL this returns an email address.
 */
function resolveRecipient(message: {
  externalSenderId: string | null;
  metadata: Prisma.JsonValue;
}): string | null {
  // externalSenderId is set on inbound messages (the sender's phone/email)
  // For outbound messages, the recipient should be in metadata or conversation participants
  const meta = message.metadata as Record<string, unknown> | null;
  if (meta?.recipient && typeof meta.recipient === 'string') {
    return meta.recipient;
  }
  if (meta?.to && typeof meta.to === 'string') {
    return meta.to;
  }
  if (meta?.phoneNumber && typeof meta.phoneNumber === 'string') {
    return meta.phoneNumber;
  }
  if (meta?.email && typeof meta.email === 'string') {
    return meta.email;
  }
  // Fallback: for inbound-reply scenarios, externalSenderId might hold the address
  return message.externalSenderId;
}
