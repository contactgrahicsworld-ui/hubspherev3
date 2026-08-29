/**
 * Campaign Service
 * 
 * Handles bulk messaging by creating multiple Message records
 * and providing progress tracking and cancellation.
 * 
 * Note: There is no dedicated Campaign model yet. This service
 * manages bulk operations by tracking message IDs in batches.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ============================================
// TYPES
// ============================================

export interface BulkMessageRecipient {
  contactId: string;
  phoneNumber?: string;
  email?: string;
}

export interface CreateBulkMessageParams {
  tenantId: string;
  userId: string;
  channel: string;
  templateId?: string;
  subject?: string;
  content: string;
  recipientList: BulkMessageRecipient[];
  scheduledAt?: string;
}

export interface BulkMessageResult {
  batchId: string;
  messageIds: string[];
  totalRecipients: number;
  created: number;
  skipped: number;
  errors: Array<{ contactId: string; reason: string }>;
}

export interface CampaignProgress {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  cancelled: number;
  other: number;
}

// ============================================
// VALID CHANNELS
// ============================================

const VALID_CHANNELS = ['WHATSAPP', 'EMAIL', 'SMS', 'IN_APP', 'PUSH'];

// ============================================
// CHANNEL → RECIPIENT FIELD MAPPING
// ============================================

function resolveRecipientAddress(
  recipient: BulkMessageRecipient,
  channel: string,
): string | null {
  if (channel === 'EMAIL') {
    return recipient.email ?? null;
  }
  // WHATSAPP and SMS use phoneNumber
  return recipient.phoneNumber ?? null;
}

// ============================================
// CREATE BULK MESSAGES
// ============================================

/**
 * Creates a Message record for each recipient.
 * Each message is linked to a shared conversation created for this batch.
 * Returns a batch result with all created message IDs.
 */
export async function createBulkMessage(
  params: CreateBulkMessageParams,
): Promise<BulkMessageResult> {
  const {
    tenantId,
    userId,
    channel,
    templateId,
    subject,
    content,
    recipientList,
    scheduledAt,
  } = params;

  if (!VALID_CHANNELS.includes(channel)) {
    return {
      batchId: '',
      messageIds: [],
      totalRecipients: recipientList.length,
      created: 0,
      skipped: recipientList.length,
      errors: recipientList.map((r) => ({
        contactId: r.contactId,
        reason: `Invalid channel: ${channel}`,
      })),
    };
  }

  // Validate template if provided
  if (templateId) {
    const template = await db.communicationTemplate.findFirst({
      where: { id: templateId, tenantId },
      select: { id: true, body: true },
    });
    if (!template) {
      return {
        batchId: '',
        messageIds: [],
        totalRecipients: recipientList.length,
        created: 0,
        skipped: recipientList.length,
        errors: [{ contactId: '', reason: 'Template not found' }],
      };
    }
  }

  // Generate a batch ID (UUID used as conversation externalId for grouping)
  const batchId = crypto.randomUUID();

  // Create a shared SYSTEM conversation for this batch
  const conversation = await db.conversation.create({
    data: {
      tenantId,
      channel,
      externalId: batchId,
      subject: subject ?? `Bulk ${channel} - ${new Date().toISOString()}`,
      status: 'ACTIVE',
      metadata: {
        isBulkBatch: true,
        batchId,
        totalRecipients: recipientList.length,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  const messageIds: string[] = [];
  let created = 0;
  const errors: Array<{ contactId: string; reason: string }> = [];

  // Create a Message per recipient
  for (const recipient of recipientList) {
    const recipientAddress = resolveRecipientAddress(recipient, channel);

    if (!recipientAddress) {
      errors.push({
        contactId: recipient.contactId,
        reason: channel === 'EMAIL'
          ? 'No email address provided for this contact'
          : 'No phone number provided for this contact',
      });
      continue;
    }

    try {
      const message = await db.message.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          direction: 'OUTBOUND',
          channel,
          content,
          contentType: 'TEXT',
          senderId: userId,
          templateId: templateId ?? null,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          status: 'QUEUED',
          metadata: {
            recipient: recipientAddress,
            contactId: recipient.contactId,
            batchId,
            subject: subject ?? null,
          } as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });

      messageIds.push(message.id);
      created++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      errors.push({
        contactId: recipient.contactId,
        reason: errorMessage,
      });
    }
  }

  return {
    batchId,
    messageIds,
    totalRecipients: recipientList.length,
    created,
    skipped: recipientList.length - created,
    errors,
  };
}

// ============================================
// GET CAMPAIGN PROGRESS
// ============================================

/**
 * Returns aggregate status counts for a batch of message IDs.
 */
export async function getCampaignProgress(
  messageIds: string[],
): Promise<CampaignProgress> {
  if (messageIds.length === 0) {
    return {
      total: 0,
      queued: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      cancelled: 0,
      other: 0,
    };
  }

  const messages = await db.message.findMany({
    where: { id: { in: messageIds } },
    select: { status: true },
  });

  const progress: CampaignProgress = {
    total: messageIds.length,
    queued: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    cancelled: 0,
    other: 0,
  };

  for (const msg of messages) {
    switch (msg.status) {
      case 'QUEUED':
      case 'PROCESSING':
        progress.queued++;
        break;
      case 'SENT':
        progress.sent++;
        break;
      case 'DELIVERED':
        progress.delivered++;
        break;
      case 'READ':
        progress.read++;
        break;
      case 'FAILED':
        progress.failed++;
        break;
      case 'CANCELLED':
        progress.cancelled++;
        break;
      default:
        progress.other++;
        break;
    }
  }

  return progress;
}

// ============================================
// CANCEL PENDING MESSAGES
// ============================================

export interface CancelResult {
  cancelled: number;
  skipped: number;
  messageIds: string[];
}

/**
 * Sets status to CANCELLED for all QUEUED messages in the given list.
 * Messages that are not in QUEUED state are skipped.
 */
export async function cancelPendingMessages(
  messageIds: string[],
): Promise<CancelResult> {
  if (messageIds.length === 0) {
    return { cancelled: 0, skipped: 0, messageIds: [] };
  }

  // Find only QUEUED messages
  const queuedMessages = await db.message.findMany({
    where: {
      id: { in: messageIds },
      status: 'QUEUED',
    },
    select: { id: true },
  });

  const queuedIds = queuedMessages.map((m) => m.id);

  if (queuedIds.length === 0) {
    return {
      cancelled: 0,
      skipped: messageIds.length,
      messageIds: [],
    };
  }

  // Update all QUEUED messages to CANCELLED
  await db.message.updateMany({
    where: {
      id: { in: queuedIds },
      status: 'QUEUED',
    },
    data: {
      status: 'CANCELLED',
    },
  });

  return {
    cancelled: queuedIds.length,
    skipped: messageIds.length - queuedIds.length,
    messageIds: queuedIds,
  };
}
