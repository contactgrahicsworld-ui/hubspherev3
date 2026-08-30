import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  ValidationError,
} from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const createTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required').max(200),
  channel: z.string().trim().min(1, 'Channel is required'),
  subject: z.string().trim().optional(),
  body: z.string().min(1, 'Template body is required'),
  category: z.string().trim().optional(),
  status: z.string().trim().default('DRAFT'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// SHARED HELPERS
// ============================================

const templateSelect = {
  id: true,
  name: true,
  channel: true,
  subject: true,
  body: true,
  variables: true,
  category: true,
  status: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} as const;

function formatTemplate(t: any) {
  return {
    id: t.id,
    name: t.name,
    channel: t.channel,
    subject: t.subject,
    body: t.body,
    variables: t.variables,
    category: t.category,
    status: t.status,
    metadata: t.metadata,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

/**
 * Extract {{variable}} placeholders from template body/subject.
 */
function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  // Deduplicate and strip the {{ }}
  const vars = new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim()));
  return Array.from(vars);
}

// ============================================
// GET /api/v1/communication/templates — List
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'templates.view', payload.tenantId, payload.isSuperAdmin);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const channel = searchParams.get('channel');
    const category = searchParams.get('category');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    if (channel) where.channel = channel;
    if (category) where.category = category;
    if (status) where.status = status;

    const [templates, total] = await Promise.all([
      db.communicationTemplate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: templateSelect,
      }),
      db.communicationTemplate.count({ where }),
    ]);

    return NextResponse.json(paginated(templates.map(formatTemplate), total, page, limit));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))
    ) {
      return NextResponse.json(
        { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 },
      );
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/communication/templates — Create
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'templates.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(createTemplateSchema, body);

    const validChannels = ['WHATSAPP', 'EMAIL', 'SMS', 'IN_APP', 'PUSH'];
    if (!validChannels.includes(data.channel)) {
      throw new ValidationError(
        `Invalid channel. Must be one of: ${validChannels.join(', ')}`,
      );
    }

    const validCategories = ['TRANSACTIONAL', 'MARKETING', 'NOTIFICATION', 'ALERT'];
    if (data.category && !validCategories.includes(data.category)) {
      throw new ValidationError(
        `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      );
    }

    const validStatuses = ['DRAFT', 'ACTIVE', 'ARCHIVED'];
    if (!validStatuses.includes(data.status)) {
      throw new ValidationError(
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      );
    }

    // Extract {{variable}} placeholders from body and subject
    const bodyVars = extractVariables(data.body);
    const subjectVars = data.subject ? extractVariables(data.subject) : [];
    const allVars = Array.from(new Set([...bodyVars, ...subjectVars]));

    const template = await db.communicationTemplate.create({
      data: {
        tenantId: payload.tenantId,
        name: data.name,
        channel: data.channel,
        subject: data.subject ?? null,
        body: data.body,
        variables: allVars,
        category: data.category ?? null,
        status: data.status,
        metadata: (data.metadata ?? {}) as any,
      },
      select: templateSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'template.create',
      targetType: 'CommunicationTemplate',
      targetId: template.id,
      metadata: {
        name: data.name,
        channel: data.channel,
        category: data.category,
        variables: allVars,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(formatTemplate(template as any), 'Template created successfully'),
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))
    ) {
      return NextResponse.json(
        { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 },
      );
    }
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
