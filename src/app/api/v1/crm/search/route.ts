import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { requirePermission } from '@/lib/rbac';

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
// GET /api/v1/crm/search — Global CRM search
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    await requirePermission(payload.roleCode ?? null, 'leads.view', payload.tenantId);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();

    if (!q || q.length < 2) {
      throw new ValidationError('Search term must be at least 2 characters');
    }

    const tenantId = payload.tenantId;
    const searchCondition = {
      contains: q,
      mode: 'insensitive' as const,
    };

    const [leads, contacts, companies, deals] = await Promise.all([
      // Search leads
      db.lead.findMany({
        where: {
          tenantId,
          archived: false,
          OR: [
            { firstName: searchCondition },
            { lastName: searchCondition },
            { email: searchCondition },
            { mobile: { contains: q } },
            { company: searchCondition },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          mobile: true,
          company: true,
          status: true,
          source: true,
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),

      // Search contacts
      db.contact.findMany({
        where: {
          tenantId,
          archived: false,
          OR: [
            { firstName: searchCondition },
            { lastName: searchCondition },
            { email: searchCondition },
            { mobile: { contains: q } },
            { phone: { contains: q } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          mobile: true,
          phone: true,
          title: true,
          companyId: true,
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),

      // Search companies
      db.company.findMany({
        where: {
          tenantId,
          archived: false,
          OR: [
            { name: searchCondition },
            { email: searchCondition },
            { phone: { contains: q } },
            { website: searchCondition },
          ],
        },
        select: {
          id: true,
          name: true,
          industry: true,
          email: true,
          phone: true,
          website: true,
          city: true,
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),

      // Search deals
      db.deal.findMany({
        where: {
          tenantId,
          archived: false,
          title: searchCondition,
        },
        select: {
          id: true,
          title: true,
          value: true,
          currency: true,
          stage: true,
          status: true,
          contactId: true,
          companyId: true,
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Combine and limit to top 20 results, keeping entity type info
    const allResults = [
      ...leads.map((l) => ({ entityType: 'LEAD' as const, ...l })),
      ...contacts.map((c) => ({ entityType: 'CONTACT' as const, ...c })),
      ...companies.map((c) => ({ entityType: 'COMPANY' as const, ...c })),
      ...deals.map((d) => ({ entityType: 'DEAL' as const, ...d })),
    ];

    // Group by entity type
    const grouped = {
      leads: leads.slice(0, 5),
      contacts: contacts.slice(0, 5),
      companies: companies.slice(0, 5),
      deals: deals.slice(0, 5),
    };

    return NextResponse.json(
      success({
        query: q,
        total: allResults.length,
        grouped,
        results: allResults.slice(0, 20),
      }),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
