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
import {
  createBulkMessage,
  getCampaignProgress,
} from '@/lib/communication/campaign-service';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const recipientSchema = z.object({
  contactId: z.string().uuid('Invalid contact ID'),
  phoneNumber: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
});

const createBulkSchema = z.object({
  channel: z.enum(['WHATSAPP', 'EMAIL', 'SMS']),
  recipientList: z.array(recipientSchema).min(1, 'At least one recipient is required').max(1000, 'Maximum 1000 recipients per batch'),
  templateId: z.string().uuid().optional(),
  content: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  scheduledAt: z.string().datetime().optional(),
});

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
// POST /api/v1/communication/bulk — Create bulk messages
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'messages.create', payload.tenantId);

    const body = await request.json();
    const data = validate(createBulkSchema, body);

    // Must provide either content or templateId
    if (!data.content && !data.templateId) {
      throw new ValidationError('Either content or templateId is required');
    }

    // Resolve content from template if needed
    let resolvedContent = data.content;
    if (data.templateId && !data.content) {
      const template = await db.communicationTemplate.findFirst({
        where: { id: data.templateId, tenantId: payload.tenantId, status: 'ACTIVE' },
        select: { id: true, body: true, subject: true },
      });
      if (!template) {
        throw new ValidationError('Active template not found');
      }
      resolvedContent = template.body;
    }

    if (!resolvedContent) {
      throw new ValidationError('Message content could not be resolved');
    }

    // Validate each recipient has the required field for the channel
    for (const recipient of data.recipientList) {
      if (data.channel === 'EMAIL' && !recipient.email) {
        throw new ValidationError(
          `Contact ${recipient.contactId} is missing an email address`,
        );
      }
      if ((data.channel === 'WHATSAPP' || data.channel === 'SMS') && !recipient.phoneNumber) {
        throw new ValidationError(
          `Contact ${recipient.contactId} is missing a phone number`,
        );
      }
    }

    // Create bulk messages via campaign service
    const result = await createBulkMessage({
      tenantId: payload.tenantId,
      userId: payload.userId,
      channel: data.channel,
      templateId: data.templateId ?? undefined,
      subject: data.subject ?? undefined,
      content: resolvedContent,
      recipientList: data.recipientList,
      scheduledAt: data.scheduledAt,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'message.bulk_create',
      targetType: 'Message',
      targetId: result.batchId,
      metadata: {
        channel: data.channel,
        totalRecipients: result.totalRecipients,
        created: result.created,
        skipped: result.skipped,
        errorCount: result.errors.length,
        batchId: result.batchId,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(
        {
          batchId: result.batchId,
          messageIds: result.messageIds,
          totalRecipients: result.totalRecipients,
          created: result.created,
          skipped: result.skipped,
          errors: result.errors,
        },
        'Bulk messages created',
      ),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// GET /api/v1/communication/bulk — Check campaign progress
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'messages.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      throw new ValidationError('batchId query parameter is required');
    }

    // Find messages for this batch by looking up the conversation with the batchId as externalId
    const conversation = await db.conversation.findFirst({
      where: {
        tenantId: payload.tenantId,
        externalId: batchId,
      },
      select: { id: true },
    });

    if (!conversation) {
      return NextResponse.json(
        success({
          batchId,
          total: 0,
          queued: 0,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          cancelled: 0,
          other: 0,
        }),
      );
    }

    const messages = await db.message.findMany({
      where: {
        conversationId: conversation.id,
        tenantId: payload.tenantId,
      },
      select: { id: true },
    });

    const messageIds = messages.map((m) => m.id);
    const progress = await getCampaignProgress(messageIds);

    return NextResponse.json(
      success({
        batchId,
        ...progress,
      }),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
