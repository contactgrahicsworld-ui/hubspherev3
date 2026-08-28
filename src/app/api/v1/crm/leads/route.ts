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

const createLeadSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(200),
  lastName: z.string().trim().max(200).optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  mobile: z.string().trim().max(30).optional(),
  company: z.string().trim().max(300).optional(),
  source: z.string().trim().max(50).optional(),
  status: z.string().trim().max(50).optional(),
  priority: z.string().trim().max(20).optional(),
  ownerId: z.string().uuid().optional(),
  value: z.number().min(0).optional(),
  description: z.string().max(5000).optional(),
});

type CreateLeadInput = z.infer<typeof createLeadSchema>;

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

function formatLead(lead: typeof leadSelect & { tags: Array<{ tag: { id: string; name: string; color: string | null } }> }) {
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
    tags: lead.tags.map((lt) => lt.tag),
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

// ============================================
// GET /api/v1/crm/leads — List leads
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'leads.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const search = searchParams.get('search') ?? '';
    const status = searchParams.get('status');
    const source = searchParams.get('source');
    const priority = searchParams.get('priority');
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
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;
    if (source) where.source = source;
    if (priority) where.priority = priority;
    if (ownerId) where.ownerId = ownerId;

    const validSortFields = ['createdAt', 'updatedAt', 'firstName', 'status', 'priority', 'value'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const [leads, total] = await Promise.all([
      db.lead.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [orderField]: orderDirection },
        select: leadSelect,
      }),
      db.lead.count({ where }),
    ]);

    return NextResponse.json(paginated(leads.map(formatLead), total, page, limit));
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
// POST /api/v1/crm/leads — Create lead
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'leads.create', payload.tenantId);

    const body = await request.json();
    const data = validate(createLeadSchema, body);

    const lead = await db.lead.create({
      data: {
        tenantId: payload.tenantId,
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        email: data.email || null,
        mobile: data.mobile ?? null,
        company: data.company ?? null,
        source: data.source ?? 'OTHER',
        status: data.status ?? 'NEW',
        priority: data.priority ?? 'MEDIUM',
        ownerId: data.ownerId ?? null,
        value: data.value ?? 0,
        description: data.description ?? null,
      },
      select: leadSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'lead.create',
      targetType: 'Lead',
      targetId: lead.id,
      metadata: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        source: data.source,
        status: data.status,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(formatLead(lead as any), 'Lead created successfully'),
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
