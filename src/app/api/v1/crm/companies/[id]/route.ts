import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
} from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const updateCompanySchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  industry: z.string().trim().max(200).nullable().optional(),
  website: z.string().trim().max(500).nullable().optional(),
  email: z
    .string()
    .email('Invalid email format')
    .nullable()
    .optional()
    .or(z.literal('')),
  phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().max(1000).nullable().optional(),
  city: z.string().trim().max(200).nullable().optional(),
  state: z.string().trim().max(200).nullable().optional(),
  country: z.string().trim().max(200).nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

// ============================================
// SHARED HELPERS
// ============================================

const companySelect = {
  id: true,
  name: true,
  industry: true,
  website: true,
  email: true,
  phone: true,
  address: true,
  city: true,
  state: true,
  country: true,
  ownerId: true,
  notes: true,
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
  _count: {
    select: { contacts: true, deals: true },
  },
} as const;

function formatCompany(company: any) {
  return {
    id: company.id,
    name: company.name,
    industry: company.industry,
    website: company.website,
    email: company.email,
    phone: company.phone,
    address: company.address,
    city: company.city,
    state: company.state,
    country: company.country,
    ownerId: company.ownerId,
    owner: company.owner,
    notes: company.notes,
    archived: company.archived,
    tags: company.tags?.map((ct: any) => ct.tag) ?? [],
    contactCount: company._count?.contacts ?? 0,
    dealCount: company._count?.deals ?? 0,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}

// ============================================
// GET /api/v1/crm/companies/:id
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

    await requirePermission(payload.roleCode ?? null, 'companies.view', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const company = await db.company.findFirst({
      where: {
        id,
        tenantId: payload.tenantId,
        archived: false,
      },
      select: companySelect,
    });

    if (!company) {
      throw new NotFoundError('Company not found');
    }

    return NextResponse.json(success(formatCompany(company as any)));
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
// PUT /api/v1/crm/companies/:id
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

    await requirePermission(payload.roleCode ?? null, 'companies.edit', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const existing = await db.company.findFirst({
      where: { id, tenantId: payload.tenantId, archived: false },
    });

    if (!existing) {
      throw new NotFoundError('Company not found');
    }

    const body = await request.json();
    const data = validate(updateCompanySchema, body);

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.industry !== undefined) updateData.industry = data.industry;
    if (data.website !== undefined) updateData.website = data.website;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const company = await db.company.update({
      where: { id },
      data: updateData,
      select: companySelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'company.update',
      targetType: 'Company',
      targetId: id,
      metadata: updateData,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(formatCompany(company as any), 'Company updated successfully'),
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
// DELETE /api/v1/crm/companies/:id — Archive
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

    await requirePermission(payload.roleCode ?? null, 'companies.delete', payload.tenantId, payload.isSuperAdmin);

    const { id } = await params;

    const existing = await db.company.findFirst({
      where: { id, tenantId: payload.tenantId, archived: false },
    });

    if (!existing) {
      throw new NotFoundError('Company not found');
    }

    await db.company.update({
      where: { id },
      data: { archived: true },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'company.archive',
      targetType: 'Company',
      targetId: id,
      metadata: { name: existing.name },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(success(null, 'Company archived successfully'));
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
