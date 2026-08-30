import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUuid(id: string): void {
  if (!UUID_RE.test(id)) {
    throw new NotFoundError('Resource not found');
  }
}

// ============================================
// SCHEMAS
// ============================================

const updateLeadSchema = z.object({
  firstName: z.string().trim().min(1).max(200).optional(),
  lastName: z.string().trim().max(200).optional(),
  email: z
    .string()
    .email('Invalid email format')
    .optional()
    .or(z.literal('')),
  mobile: z.string().trim().max(30).optional(),
  company: z.string().trim().max(300).optional(),
  source: z.string().trim().max(50).optional(),
  status: z.string().trim().max(50).optional(),
  priority: z.string().trim().max(20).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  value: z.number().min(0).optional(),
  description: z.string().max(5000).nullable().optional(),
});

// ============================================
// SHARED HELPERS
// ============================================

const leadSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  mobile: true,
  company: true,
  source: true,
  status: true,
  priority: true,
  ownerId: true,
  value: true,
  description: true,
  convertedToContactId: true,
  archived: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  tags: {
    select: {
      tag: { select: { id: true, name: true, color: true } },
    },
  },
} as const;

function formatLead(lead: any) {
  return {
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    mobile: lead.mobile,
    company: lead.company,
    source: lead.source,
    status: lead.status,
    priority: lead.priority,
    ownerId: lead.ownerId,
    owner: lead.owner,
    value: lead.value,
    description: lead.description,
    convertedToContactId: lead.convertedToContactId,
    archived: lead.archived,
    tags: lead.tags?.map((lt: any) => lt.tag) ?? [],
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

// ============================================
// GET /api/v1/crm/leads/:id
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

    await requirePermission(payload.roleCode ?? null, 'leads.view', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;
    validateUuid(id);

    const lead = await db.lead.findFirst({
      where: {
        id,
        tenantId: payload.tenantId,
        archived: false,
      },
      select: leadSelect,
    });

    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    return NextResponse.json(success(formatLead(lead as any)));
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
// PUT /api/v1/crm/leads/:id
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'leads.edit', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;
    validateUuid(id);

    const existing = await db.lead.findFirst({
      where: { id, tenantId: payload.tenantId, archived: false },
    });

    if (!existing) {
      throw new NotFoundError('Lead not found');
    }

    const body = await request.json();
    const data = validate(updateLeadSchema, body);

    // Validate owner belongs to the same tenant if provided
    if (data.ownerId) {
      const ownerExists = await db.membership.findFirst({
        where: { userId: data.ownerId, tenantId: payload.tenantId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!ownerExists) {
        throw new ValidationError('Owner not found');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName ?? null;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.mobile !== undefined) updateData.mobile = data.mobile ?? null;
    if (data.company !== undefined) updateData.company = data.company ?? null;
    if (data.source !== undefined) updateData.source = data.source;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.description !== undefined) updateData.description = data.description;

    const lead = await db.lead.update({
      where: { id },
      data: updateData,
      select: leadSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'lead.update',
      targetType: 'Lead',
      targetId: id,
      metadata: updateData,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(formatLead(lead as any), 'Lead updated successfully'),
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
// DELETE /api/v1/crm/leads/:id — Archive
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

    await requirePermission(payload.roleCode ?? null, 'leads.delete', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;
    validateUuid(id);

    const existing = await db.lead.findFirst({
      where: { id, tenantId: payload.tenantId, archived: false },
    });

    if (!existing) {
      throw new NotFoundError('Lead not found');
    }

    if (existing.convertedToContactId) {
      throw new ConflictError('Cannot archive a lead that has been converted to a contact');
    }

    await db.lead.update({
      where: { id },
      data: { archived: true },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'lead.archive',
      targetType: 'Lead',
      targetId: id,
      metadata: { firstName: existing.firstName, lastName: existing.lastName },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Lead archived successfully'));
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
