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

const createDealSchema = z.object({
  title: z.string().trim().min(1, 'Deal title is required').max(500),
  value: z.number().min(0).optional(),
  currency: z.string().trim().max(10).optional(),
  stage: z.string().trim().max(50).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  contactId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  notes: z.string().max(5000).optional(),
});

type CreateDealInput = z.infer<typeof createDealSchema>;

// ============================================
// SHARED HELPERS
// ============================================

const dealSelect = {
  id: true,
  title: true,
  value: true,
  currency: true,
  stage: true,
  probability: true,
  expectedCloseDate: true,
  contactId: true,
  companyId: true,
  ownerId: true,
  notes: true,
  lostReason: true,
  archived: true,
  createdAt: true,
  updatedAt: true,
  contact: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  company: {
    select: { id: true, name: true, industry: true },
  },
  owner: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
} as const;

function formatDeal(deal: any) {
  return {
    id: deal.id,
    title: deal.title,
    value: deal.value,
    currency: deal.currency,
    stage: deal.stage,
    probability: deal.probability,
    expectedCloseDate: deal.expectedCloseDate,
    contactId: deal.contactId,
    contact: deal.contact,
    companyId: deal.companyId,
    company: deal.company,
    ownerId: deal.ownerId,
    owner: deal.owner,
    notes: deal.notes,
    lostReason: deal.lostReason,
    archived: deal.archived,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
  };
}

// ============================================
// GET /api/v1/crm/deals — List deals
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'deals.view', payload.tenantId, payload.isSuperAdmin);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const search = searchParams.get('search') ?? '';
    const stage = searchParams.get('stage');
    const contactId = searchParams.get('contactId');
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
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (stage) where.stage = stage;
    if (contactId) where.contactId = contactId;
    if (companyId) where.companyId = companyId;
    if (ownerId) where.ownerId = ownerId;

    const validSortFields = ['createdAt', 'updatedAt', 'title', 'value', 'stage', 'expectedCloseDate'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const [deals, total] = await Promise.all([
      db.deal.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [orderField]: orderDirection },
        select: dealSelect,
      }),
      db.deal.count({ where }),
    ]);

    return NextResponse.json(paginated(deals.map(formatDeal), total, page, limit));
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
// POST /api/v1/crm/deals — Create deal
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'deals.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(createDealSchema, body);

    // Validate contact belongs to tenant if provided
    if (data.contactId) {
      const contact = await db.contact.findFirst({
        where: { id: data.contactId, tenantId: payload.tenantId, archived: false },
        select: { id: true },
      });
      if (!contact) {
        throw new ValidationError('Contact not found');
      }
    }

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

    // Narrow tenantId for use inside transaction callback
    const tenantId = payload.tenantId!;

    const deal = await db.$transaction(async (tx) => {
      const created = await tx.deal.create({
        data: {
          tenantId,
          title: data.title,
          value: data.value ?? 0,
          currency: data.currency ?? 'INR',
          stage: data.stage ?? 'NEW',
          probability: data.probability ?? 0,
          expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
          contactId: data.contactId ?? null,
          companyId: data.companyId ?? null,
          ownerId: data.ownerId ?? null,
          notes: data.notes ?? null,
        },
        select: dealSelect,
      });

      // Create initial stage history in the same transaction
      await tx.stageHistory.create({
        data: {
          dealId: created.id,
          fromStage: null,
          toStage: data.stage ?? 'NEW',
          movedBy: payload.userId,
        },
      });

      return created;
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'deal.create',
      targetType: 'Deal',
      targetId: deal.id,
      metadata: {
        title: data.title,
        value: data.value,
        stage: data.stage,
        contactId: data.contactId,
        companyId: data.companyId,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(formatDeal(deal as any), 'Deal created successfully'),
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
