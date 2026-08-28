import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, NotFoundError, ConflictError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

// ============================================
// HELPERS
// ============================================

function isDbError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message?.includes('connect') || error.message?.includes('ECONNREFUSED'))
  );
}

function dbUnavailableResponse() {
  return NextResponse.json(
    { success: false, error: 'Database unavailable', code: 'SERVICE_UNAVAILABLE' },
    { status: 503 },
  );
}

// ============================================
// POST /api/v1/crm/leads/:id/convert — Convert lead to contact
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'leads.edit', payload.tenantId);

    const { id } = await params;

    const lead = await db.lead.findFirst({
      where: { id, tenantId: payload.tenantId, archived: false },
    });

    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    if (lead.convertedToContactId) {
      throw new ConflictError('Lead has already been converted to a contact');
    }

    // Find or create company from lead.company
    let companyId: string | null = null;
    if (lead.company) {
      const existingCompany = await db.company.findFirst({
        where: {
          tenantId: payload.tenantId,
          name: { equals: lead.company, mode: 'insensitive' },
          archived: false,
        },
      });

      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const newCompany = await db.company.create({
          data: {
            tenantId: payload.tenantId,
            name: lead.company,
            ownerId: lead.ownerId ?? payload.userId,
          },
        });
        companyId = newCompany.id;
      }
    }

    // Create Contact from lead data
    const contact = await db.contact.create({
      data: {
        tenantId: payload.tenantId,
        firstName: lead.firstName,
        lastName: lead.lastName ?? null,
        email: lead.email ?? null,
        mobile: lead.mobile ?? null,
        companyId,
        ownerId: lead.ownerId ?? payload.userId,
      },
    });

    // Update lead with convertedToContactId
    await db.lead.update({
      where: { id },
      data: {
        convertedToContactId: contact.id,
        status: 'CONVERTED',
      },
    });

    // Create Activity record
    await db.activity.create({
      data: {
        tenantId: payload.tenantId,
        type: 'LEAD_STATUS',
        title: 'Lead converted to contact',
        description: `Lead "${lead.firstName} ${lead.lastName ?? ''}" converted to contact.`,
        userId: payload.userId,
        leadId: id,
        contactId: contact.id,
      },
    });

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'lead.convert',
      targetType: 'Lead',
      targetId: id,
      metadata: {
        contactId: contact.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
      },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json(
      success({
        leadId: id,
        contactId: contact.id,
        companyId,
      }, 'Lead converted to contact successfully'),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
