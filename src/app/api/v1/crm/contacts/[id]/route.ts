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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUuid(id: string): void {
  if (!UUID_RE.test(id)) {
    throw new NotFoundError('Resource not found');
  }
}

// ============================================
// SCHEMAS
// ============================================

const updateContactSchema = z.object({
  firstName: z.string().trim().min(1).max(200).optional(),
  lastName: z.string().trim().max(200).optional(),
  email: z
    .string()
    .email('Invalid email format')
    .optional()
    .or(z.literal('')),
  mobile: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(30).optional(),
  title: z.string().trim().max(200).optional(),
  companyId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

// ============================================
// SHARED HELPERS
// ============================================

const contactSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  mobile: true,
  phone: true,
  title: true,
  companyId: true,
  ownerId: true,
  notes: true,
  archived: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  company: {
    select: { id: true, name: true, industry: true },
  },
  tags: {
    select: {
      tag: { select: { id: true, name: true, color: true } },
    },
  },
} as const;

function formatContact(contact: any) {
  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    mobile: contact.mobile,
    phone: contact.phone,
    title: contact.title,
    companyId: contact.companyId,
    company: contact.company,
    ownerId: contact.ownerId,
    owner: contact.owner,
    notes: contact.notes,
    archived: contact.archived,
    tags: contact.tags?.map((ct: any) => ct.tag) ?? [],
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  };
}

// ============================================
// GET /api/v1/crm/contacts/:id
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

    await requirePermission(payload.roleCode ?? null, 'contacts.view', payload.tenantId);

    const { id } = await params;
    validateUuid(id);

    const contact = await db.contact.findFirst({
      where: {
        id,
        tenantId: payload.tenantId,
        archived: false,
      },
      select: contactSelect,
    });

    if (!contact) {
      throw new NotFoundError('Contact not found');
    }

    return NextResponse.json(success(formatContact(contact as any)));
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
// PUT /api/v1/crm/contacts/:id
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

    await requirePermission(payload.roleCode ?? null, 'contacts.edit', payload.tenantId);

    const { id } = await params;
    validateUuid(id);

    const existing = await db.contact.findFirst({
      where: { id, tenantId: payload.tenantId, archived: false },
    });

    if (!existing) {
      throw new NotFoundError('Contact not found');
    }

    const body = await request.json();
    const data = validate(updateContactSchema, body);

    // Validate company belongs to tenant if provided
    if (data.companyId) {
      const company = await db.company.findFirst({
        where: { id: data.companyId, tenantId: payload.tenantId, archived: false },
        select: { id: true },
      });
      if (!company) {
        throw new NotFoundError('Company not found');
      }
    }

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
    if (data.phone !== undefined) updateData.phone = data.phone ?? null;
    if (data.title !== undefined) updateData.title = data.title ?? null;
    if (data.companyId !== undefined) updateData.companyId = data.companyId;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const contact = await db.contact.update({
      where: { id },
      data: updateData,
      select: contactSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'contact.update',
      targetType: 'Contact',
      targetId: id,
      metadata: updateData,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(formatContact(contact as any), 'Contact updated successfully'),
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
// DELETE /api/v1/crm/contacts/:id — Archive
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

    await requirePermission(payload.roleCode ?? null, 'contacts.delete', payload.tenantId);

    const { id } = await params;
    validateUuid(id);

    const existing = await db.contact.findFirst({
      where: { id, tenantId: payload.tenantId, archived: false },
    });

    if (!existing) {
      throw new NotFoundError('Contact not found');
    }

    await db.contact.update({
      where: { id },
      data: { archived: true },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'contact.archive',
      targetType: 'Contact',
      targetId: id,
      metadata: { firstName: existing.firstName, lastName: existing.lastName },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Contact archived successfully'));
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
