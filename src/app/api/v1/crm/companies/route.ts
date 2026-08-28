import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
} from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const createCompanySchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(300),
  industry: z.string().trim().max(200).optional(),
  website: z.string().trim().max(500).optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional(),
  address: z.string().max(1000).optional(),
  city: z.string().trim().max(200).optional(),
  state: z.string().trim().max(200).optional(),
  country: z.string().trim().max(200).optional(),
  ownerId: z.string().uuid().optional(),
  notes: z.string().max(5000).optional(),
});

type CreateCompanyInput = z.infer<typeof createCompanySchema>;

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
// GET /api/v1/crm/companies — List companies
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'companies.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const search = searchParams.get('search') ?? '';
    const industry = searchParams.get('industry');
    const ownerId = searchParams.get('ownerId');
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const country = searchParams.get('country');
    const sortBy = searchParams.get('sortBy') ?? 'createdAt';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
      archived: false,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { website: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (industry) where.industry = industry;
    if (ownerId) where.ownerId = ownerId;
    if (city) where.city = city;
    if (state) where.state = state;
    if (country) where.country = country;

    const validSortFields = ['createdAt', 'updatedAt', 'name', 'industry'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const [companies, total] = await Promise.all([
      db.company.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [orderField]: orderDirection },
        select: companySelect,
      }),
      db.company.count({ where }),
    ]);

    return NextResponse.json(paginated(companies.map(formatCompany), total, page, limit));
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
// POST /api/v1/crm/companies — Create company
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'companies.create', payload.tenantId);

    const body = await request.json();
    const data = validate(createCompanySchema, body);

    const company = await db.company.create({
      data: {
        tenantId: payload.tenantId,
        name: data.name,
        industry: data.industry ?? null,
        website: data.website ?? null,
        email: data.email || null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        country: data.country ?? null,
        ownerId: data.ownerId ?? null,
        notes: data.notes ?? null,
      },
      select: companySelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'company.create',
      targetType: 'Company',
      targetId: company.id,
      metadata: {
        name: data.name,
        industry: data.industry,
        email: data.email,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(formatCompany(company as any), 'Company created successfully'),
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
