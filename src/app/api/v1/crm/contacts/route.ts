import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { success, paginated } from '@/lib/api-response';

// ============================================
// SCHEMAS
// ============================================

const createContactSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(200),
  lastName: z.string().trim().max(200).optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  mobile: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(30).optional(),
  title: z.string().trim().max(200).optional(),
  companyId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  notes: z.string().max(5000).optional(),
});

type CreateContactInput = z.infer<typeof createContactSchema>;

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
// GET /api/v1/crm/contacts — List contacts
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'contacts.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const search = searchParams.get('search') ?? '';
    const companyId = searchParams.get('companyId');
    const ownerId = searchParams.get('ownerId');
    const sortBy = searchParams.get('sortBy') ?? 'createdAt';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
      archived: false,
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search } },
        { phone: { contains: search } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (companyId) where.companyId = companyId;
    if (ownerId) where.ownerId = ownerId;

    const validSortFields = ['createdAt', 'updatedAt', 'firstName', 'email'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const [contacts, total] = await Promise.all([
      db.contact.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [orderField]: orderDirection },
        select: contactSelect,
      }),
      db.contact.count({ where }),
    ]);

    return NextResponse.json(paginated(contacts.map(formatContact), total, page, limit));
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
// POST /api/v1/crm/contacts — Create contact
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'contacts.create', payload.tenantId);

    const body = await request.json();
    const data = validate(createContactSchema, body);

    // Validate company belongs to tenant if provided
    if (data.companyId) {
      const company = await db.company.findFirst({
        where: { id: data.companyId, tenantId: payload.tenantId, archived: false },
        select: { id: true },
      });
      if (!company) {
        throw new ValidationError('Company not found');
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

    const contact = await db.contact.create({
      data: {
        tenantId: payload.tenantId,
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        email: data.email || null,
        mobile: data.mobile ?? null,
        phone: data.phone ?? null,
        title: data.title ?? null,
        companyId: data.companyId ?? null,
        ownerId: data.ownerId ?? null,
        notes: data.notes ?? null,
      },
      select: contactSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'contact.create',
      targetType: 'Contact',
      targetId: contact.id,
      metadata: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        companyId: data.companyId,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(formatContact(contact as any), 'Contact created successfully'),
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
