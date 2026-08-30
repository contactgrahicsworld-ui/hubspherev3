import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/errors';
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

function escapeCSVField(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ============================================
// GET /api/v1/crm/export — Export CSV
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');

    if (!['leads', 'contacts', 'companies', 'deals'].includes(entityType ?? '')) {
      throw new ValidationError('entityType must be leads, contacts, companies, or deals');
    }

    await requirePermission(payload.roleCode ?? null, `${entityType}.view`, payload.tenantId, payload.isSuperAdmin);

    const tenantId = payload.tenantId;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const source = searchParams.get('source');
    const priority = searchParams.get('priority');

    let csvContent = '';
    let filename = '';

    if (entityType === 'leads') {
      const where: Record<string, unknown> = { tenantId, archived: false };
      if (status) where.status = status;
      if (source) where.source = source;
      if (priority) where.priority = priority;
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } },
        ];
      }

      const leads = await db.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          firstName: true, lastName: true, email: true, mobile: true,
          company: true, source: true, status: true, priority: true,
          value: true, createdAt: true, updatedAt: true,
          owner: { select: { name: true, email: true } },
        },
      });

      const headers = ['First Name', 'Last Name', 'Email', 'Mobile', 'Company', 'Source', 'Status', 'Priority', 'Value', 'Owner', 'Created At', 'Updated At'];
      const rows = leads.map((l) => [
        l.firstName, l.lastName ?? '', l.email ?? '', l.mobile ?? '',
        l.company ?? '', l.source, l.status, l.priority,
        l.value ?? 0, l.owner?.name ?? '', l.createdAt.toISOString(), l.updatedAt.toISOString(),
      ]);

      csvContent = [headers.map(escapeCSVField).join(','), ...rows.map((r) => r.map(escapeCSVField).join(','))].join('\n');
      filename = 'leads-export.csv';

    } else if (entityType === 'contacts') {
      const where: Record<string, unknown> = { tenantId, archived: false };
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      const contacts = await db.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          firstName: true, lastName: true, email: true, mobile: true,
          phone: true, title: true,
          company: { select: { name: true } },
          owner: { select: { name: true, email: true } },
          createdAt: true, updatedAt: true,
        },
      });

      const headers = ['First Name', 'Last Name', 'Email', 'Mobile', 'Phone', 'Title', 'Company', 'Owner', 'Created At', 'Updated At'];
      const rows = contacts.map((c) => [
        c.firstName, c.lastName ?? '', c.email ?? '', c.mobile ?? '',
        c.phone ?? '', c.title ?? '', c.company?.name ?? '', c.owner?.name ?? '',
        c.createdAt.toISOString(), c.updatedAt.toISOString(),
      ]);

      csvContent = [headers.map(escapeCSVField).join(','), ...rows.map((r) => r.map(escapeCSVField).join(','))].join('\n');
      filename = 'contacts-export.csv';

    } else if (entityType === 'companies') {
      const where: Record<string, unknown> = { tenantId, archived: false };
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      const companies = await db.company.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          name: true, industry: true, website: true, email: true,
          phone: true, address: true, city: true, state: true, country: true,
          owner: { select: { name: true, email: true } },
          createdAt: true, updatedAt: true,
        },
      });

      const headers = ['Name', 'Industry', 'Website', 'Email', 'Phone', 'Address', 'City', 'State', 'Country', 'Owner', 'Created At', 'Updated At'];
      const rows = companies.map((c) => [
        c.name, c.industry ?? '', c.website ?? '', c.email ?? '',
        c.phone ?? '', c.address ?? '', c.city ?? '', c.state ?? '', c.country ?? '',
        c.owner?.name ?? '', c.createdAt.toISOString(), c.updatedAt.toISOString(),
      ]);

      csvContent = [headers.map(escapeCSVField).join(','), ...rows.map((r) => r.map(escapeCSVField).join(','))].join('\n');
      filename = 'companies-export.csv';

    } else if (entityType === 'deals') {
      const where: Record<string, unknown> = { tenantId, archived: false };
      if (status) where.status = status;
      if (search) {
        where.title = { contains: search, mode: 'insensitive' };
      }

      const deals = await db.deal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          title: true, value: true, currency: true, stage: true,
          probability: true, expectedCloseDate: true,
          contact: { select: { firstName: true, lastName: true, email: true } },
          company: { select: { name: true } },
          owner: { select: { name: true, email: true } },
          createdAt: true, updatedAt: true,
        },
      });

      const headers = ['Title', 'Value', 'Currency', 'Stage', 'Probability', 'Expected Close Date', 'Contact', 'Company', 'Owner', 'Created At', 'Updated At'];
      const rows = deals.map((d) => [
        d.title, d.value, d.currency, d.stage,
        d.probability ?? 0, d.expectedCloseDate?.toISOString() ?? '',
        d.contact ? `${d.contact.firstName} ${d.contact.lastName ?? ''}` : '',
        d.company?.name ?? '', d.owner?.name ?? '',
        d.createdAt.toISOString(), d.updatedAt.toISOString(),
      ]);

      csvContent = [headers.map(escapeCSVField).join(','), ...rows.map((r) => r.map(escapeCSVField).join(','))].join('\n');
      filename = 'deals-export.csv';
    }

    await createAuditLog({
      actorId: payload.userId,
      tenantId: payload.tenantId,
      action: 'export.csv',
      targetType: entityType!,
      metadata: { filename },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
