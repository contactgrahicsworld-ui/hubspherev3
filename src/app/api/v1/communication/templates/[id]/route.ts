import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  subject: z.string().trim().nullable().optional(),
  body: z.string().min(1).optional(),
  category: z.string().trim().nullable().optional(),
  status: z.string().trim().optional(),
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

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  const vars = new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim()));
  return Array.from(vars);
}

// ============================================
// GET /api/v1/communication/templates/:id
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

    await requirePermission(payload.roleCode ?? null, 'templates.view', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const template = await db.communicationTemplate.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: templateSelect,
    });

    if (!template) {
      throw new NotFoundError('Template not found');
    }

    return NextResponse.json(success(formatTemplate(template as any)));
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
// PATCH /api/v1/communication/templates/:id — Update
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'templates.edit', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const existing = await db.communicationTemplate.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: { id: true, subject: true },
    });

    if (!existing) {
      throw new NotFoundError('Template not found');
    }

    const body = await request.json();
    const data = validate(updateTemplateSchema, body);

    const validStatuses = ['DRAFT', 'ACTIVE', 'ARCHIVED'];
    if (data.status && !validStatuses.includes(data.status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const validCategories = ['TRANSACTIONAL', 'MARKETING', 'NOTIFICATION', 'ALERT'];
    if (data.category && !validCategories.includes(data.category)) {
      throw new ValidationError(
        `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      );
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.body !== undefined) {
      updateData.body = data.body;
      // Re-extract variables when body changes
      const subjectText = data.subject ?? existing?.subject ?? '';
      const bodyVars = extractVariables(data.body);
      const subjectVars = typeof subjectText === 'string' ? extractVariables(subjectText) : [];
      updateData.variables = Array.from(new Set([...bodyVars, ...subjectVars]));
    }
    if (data.category !== undefined) updateData.category = data.category;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    const template = await db.communicationTemplate.update({
      where: { id },
      data: updateData,
      select: templateSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'template.update',
      targetType: 'CommunicationTemplate',
      targetId: id,
      metadata: { changes: Object.keys(updateData) },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(formatTemplate(template as any), 'Template updated successfully'),
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

// ============================================
// DELETE /api/v1/communication/templates/:id — Archive
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'templates.delete', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const existing = await db.communicationTemplate.findFirst({
      where: { id, tenantId: payload.tenantId },
      select: { id: true, name: true },
    });

    if (!existing) {
      throw new NotFoundError('Template not found');
    }

    await db.communicationTemplate.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'template.archive',
      targetType: 'CommunicationTemplate',
      targetId: id,
      metadata: { name: existing.name },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Template archived successfully'));
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
