import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paginationSchema, validate } from '@/lib/validators';
import {
  handleApiError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { success, paginated } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

// ============================================
// HELPERS
// ============================================

function isDbError(error: unknown) {
  return error instanceof Error && (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'));
}

function dbUnavailableResponse() {
  return NextResponse.json(
    { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
    { status: 503 },
  );
}

// ============================================
// SCHEMAS
// ============================================

const createFieldVisitSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID format'),
  leadId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  date: z.string().min(1, 'Date is required').refine((v) => !isNaN(Date.parse(v)), 'Invalid date format'),
  purpose: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
  nextFollowUp: z.string().refine((v) => v === undefined || v === '' || !isNaN(Date.parse(v)), 'Invalid nextFollowUp date').optional(),
});

type CreateFieldVisitInput = z.infer<typeof createFieldVisitSchema>;

// ============================================
// SHARED SELECT
// ============================================

const fieldVisitSelect = {
  id: true,
  employeeId: true,
  leadId: true,
  contactId: true,
  date: true,
  startTime: true,
  endTime: true,
  purpose: true,
  outcome: true,
  notes: true,
  status: true,
  location: true,
  nextFollowUp: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
    },
  },
  lead: {
    select: { id: true, firstName: true, lastName: true, company: true },
  },
  contact: {
    select: { id: true, firstName: true, lastName: true, email: true, company: { select: { name: true } } },
  },
} as const;

// ============================================
// GET /api/v1/hrms/field-visits — List field visits
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'visits.view', payload.tenantId, payload.isSuperAdmin);

    const { searchParams } = new URL(request.url);
    const { page, limit } = validate(paginationSchema, {
      page: searchParams.get('page') ?? '1',
      limit: searchParams.get('limit') ?? '20',
    });

    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sortBy = searchParams.get('sortBy') ?? 'date';
    const sortOrder = searchParams.get('sortOrder') ?? 'desc';

    const where: Record<string, unknown> = {
      tenantId: payload.tenantId,
    };

    const validStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (employeeId) {
      if (!z.string().uuid().safeParse(employeeId).success) {
        throw new ValidationError('Invalid employeeId format');
      }
      where.employeeId = employeeId;
    }
    if (status) {
      if (!validStatuses.includes(status)) throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      where.status = status;
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.date = dateFilter;
    }

    const validSortFields = ['date', 'createdAt', 'updatedAt', 'status', 'startTime'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'date';
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const [visits, total] = await Promise.all([
      db.fieldVisit.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [orderField]: orderDirection },
        select: fieldVisitSelect,
      }),
      db.fieldVisit.count({ where }),
    ]);

    return NextResponse.json(paginated(visits, total, page, limit));
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}

// ============================================
// POST /api/v1/hrms/field-visits — Create field visit
// ============================================

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'visits.create', payload.tenantId, payload.isSuperAdmin);

    const body = await request.json();
    const data = validate(createFieldVisitSchema, body);

    if (data.employeeId) {
      const employee = await db.employee.findFirst({ where: { id: data.employeeId, tenantId: payload.tenantId, archived: false } });
      if (!employee) {
        throw new NotFoundError('Employee not found');
      }
    }

    if (data.leadId) {
      const lead = await db.lead.findFirst({ where: { id: data.leadId, tenantId: payload.tenantId, archived: false } });
      if (!lead) {
        throw new NotFoundError('Lead not found');
      }
    }

    if (data.contactId) {
      const contact = await db.contact.findFirst({ where: { id: data.contactId, tenantId: payload.tenantId, archived: false } });
      if (!contact) {
        throw new NotFoundError('Contact not found');
      }
    }

    const visit = await db.fieldVisit.create({
      data: {
        tenantId: payload.tenantId,
        employeeId: data.employeeId,
        leadId: data.leadId ?? null,
        contactId: data.contactId ?? null,
        date: new Date(data.date),
        purpose: data.purpose ?? null,
        notes: data.notes ?? null,
        nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp) : null,
        status: 'PLANNED',
      },
      select: fieldVisitSelect,
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'field_visit.create',
      targetType: 'FieldVisit',
      targetId: visit.id,
      metadata: {
        employeeId: data.employeeId,
        date: data.date,
        purpose: data.purpose,
        leadId: data.leadId,
        contactId: data.contactId,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success(visit, 'Field visit created successfully'),
      { status: 201 },
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
