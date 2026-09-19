/**
 * Global Search / Command Center API
 * Unified search across ALL entity types based on user permissions.
 * Uses parallel queries (Promise.all) for speed.
 * Only searches entity types the user has permission to view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/errors';
import { success } from '@/lib/api-response';
import { getAuthUser } from '@/lib/api-auth';
import { hasPermission } from '@/lib/rbac';

// ============================================
// TYPES
// ============================================

type SearchEntityType =
  | 'lead'
  | 'contact'
  | 'company'
  | 'deal'
  | 'task'
  | 'employee'
  | 'invoice'
  | 'call'
  | 'fieldVisit';

interface SearchResult {
  type: SearchEntityType;
  id: string;
  label: string;
  subtitle: string;
  href: string;
}

// Valid search type filters from the query string
type SearchTypeFilter =
  | 'leads'
  | 'contacts'
  | 'companies'
  | 'deals'
  | 'tasks'
  | 'employees'
  | 'products'
  | 'orders'
  | 'invoices'
  | 'vendors'
  | 'campaigns'
  | 'calls'
  | 'fieldVisits';

// Map filter names to entity types and their required permissions
const ENTITY_CONFIG: Record<
  SearchEntityType,
  { filterNames: SearchTypeFilter[]; permission: string }
> = {
  lead: { filterNames: ['leads'], permission: 'leads.view' },
  contact: { filterNames: ['contacts'], permission: 'contacts.view' },
  company: { filterNames: ['companies'], permission: 'companies.view' },
  deal: { filterNames: ['deals'], permission: 'deals.view' },
  task: { filterNames: ['tasks'], permission: 'tasks.view' },
  employee: { filterNames: ['employees'], permission: 'employees.view' },
  invoice: { filterNames: ['invoices'], permission: 'billing.view' },
  call: { filterNames: ['calls'], permission: 'calls.view' },
  fieldVisit: { filterNames: ['fieldVisits'], permission: 'field_visits.view' },
};

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

/**
 * Check if a given entity type should be searched based on:
 * 1. Explicit type filter from the query (if provided)
 * 2. User's permission for that entity
 */
function shouldSearchEntity(
  entityType: SearchEntityType,
  typeFilters: SearchTypeFilter[] | null,
  permittedEntities: Set<SearchEntityType>,
): boolean {
  // Must have permission
  if (!permittedEntities.has(entityType)) return false;

  // If no type filter specified, search all permitted types
  if (!typeFilters || typeFilters.length === 0) return true;

  // Check if any of the filter names match this entity
  const config = ENTITY_CONFIG[entityType];
  return typeFilters.some((f) => config.filterNames.includes(f));
}

// ============================================
// GET /api/v1/search — Global unified search
// ============================================

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthUser(request);

    if (!payload.tenantId) {
      throw new AuthenticationError('Tenant context required');
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.trim() ?? searchParams.get('q')?.trim() ?? '';

    if (!query || query.length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }

    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    // Parse type filters
    const typesParam = searchParams.get('types');
    const typeFilters: SearchTypeFilter[] | null = typesParam
      ? (typesParam.split(',').filter(Boolean) as SearchTypeFilter[])
      : null;

    const tenantId = payload.tenantId;
    const roleCode = payload.roleCode ?? null;
    const isSuperAdmin = payload.isSuperAdmin;

    // Determine which entity types the user can search (parallel permission checks)
    const entityTypes = Object.keys(ENTITY_CONFIG) as SearchEntityType[];
    const permissionChecks = await Promise.all(
      entityTypes.map(async (entityType) => {
        const hasAccess = await hasPermission(
          roleCode,
          ENTITY_CONFIG[entityType].permission,
          tenantId,
          isSuperAdmin,
        );
        return { entityType, hasAccess };
      }),
    );

    const permittedEntities = new Set<SearchEntityType>(
      permissionChecks.filter((c) => c.hasAccess).map((c) => c.entityType),
    );

    // Build the case-insensitive search condition
    const sc = {
      contains: query,
      mode: 'insensitive' as const,
    };

    // Execute searches in parallel for all permitted+filtered entity types
    const searchPromises: Promise<SearchResult[]>[] = [];

    // --- LEADS ---
    if (shouldSearchEntity('lead', typeFilters, permittedEntities)) {
      searchPromises.push(
        db.lead
          .findMany({
            where: {
              tenantId,
              archived: false,
              OR: [
                { firstName: sc },
                { lastName: sc },
                { email: sc },
                { mobile: { contains: query } },
                { company: sc },
              ],
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              company: true,
              status: true,
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
          .then((rows) =>
            rows.map((r) => ({
              type: 'lead' as const,
              id: r.id,
              label: `${r.firstName}${r.lastName ? ` ${r.lastName}` : ''}`,
              subtitle: `${r.company ?? 'No company'} • ${r.status}`,
              href: `/crm/leads/${r.id}`,
            })),
          ),
      );
    }

    // --- CONTACTS ---
    if (shouldSearchEntity('contact', typeFilters, permittedEntities)) {
      searchPromises.push(
        db.contact
          .findMany({
            where: {
              tenantId,
              archived: false,
              OR: [
                { firstName: sc },
                { lastName: sc },
                { email: sc },
                { mobile: { contains: query } },
                { phone: { contains: query } },
              ],
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              title: true,
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
          .then((rows) =>
            rows.map((r) => ({
              type: 'contact' as const,
              id: r.id,
              label: `${r.firstName}${r.lastName ? ` ${r.lastName}` : ''}`,
              subtitle: r.title ?? r.email ?? 'Contact',
              href: `/crm/contacts/${r.id}`,
            })),
          ),
      );
    }

    // --- COMPANIES ---
    if (shouldSearchEntity('company', typeFilters, permittedEntities)) {
      searchPromises.push(
        db.company
          .findMany({
            where: {
              tenantId,
              archived: false,
              OR: [
                { name: sc },
                { email: sc },
                { phone: { contains: query } },
                { website: sc },
                { city: sc },
              ],
            },
            select: {
              id: true,
              name: true,
              industry: true,
              city: true,
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
          .then((rows) =>
            rows.map((r) => ({
              type: 'company' as const,
              id: r.id,
              label: r.name,
              subtitle: r.industry ?? r.city ?? 'Company',
              href: `/crm/companies/${r.id}`,
            })),
          ),
      );
    }

    // --- DEALS ---
    if (shouldSearchEntity('deal', typeFilters, permittedEntities)) {
      searchPromises.push(
        db.deal
          .findMany({
            where: {
              tenantId,
              archived: false,
              OR: [{ title: sc }],
            },
            select: {
              id: true,
              title: true,
              value: true,
              currency: true,
              stage: true,
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
          .then((rows) =>
            rows.map((r) => ({
              type: 'deal' as const,
              id: r.id,
              label: r.title,
              subtitle: `${r.currency} ${r.value.toLocaleString()} • ${r.stage}`,
              href: `/crm/deals/${r.id}`,
            })),
          ),
      );
    }

    // --- TASKS ---
    if (shouldSearchEntity('task', typeFilters, permittedEntities)) {
      searchPromises.push(
        db.task
          .findMany({
            where: {
              tenantId,
              OR: [{ title: sc }, { description: sc }],
            },
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
          .then((rows) =>
            rows.map((r) => ({
              type: 'task' as const,
              id: r.id,
              label: r.title,
              subtitle: `${r.status} • ${r.priority}`,
              href: `/crm/tasks`,
            })),
          ),
      );
    }

    // --- EMPLOYEES ---
    if (shouldSearchEntity('employee', typeFilters, permittedEntities)) {
      searchPromises.push(
        db.employee
          .findMany({
            where: {
              tenantId,
              archived: false,
              OR: [
                { firstName: sc },
                { lastName: sc },
                { email: sc },
                { mobile: { contains: query } },
                { employeeId: { contains: query } },
              ],
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employmentStatus: true,
              employeeId: true,
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
          .then((rows) =>
            rows.map((r) => ({
              type: 'employee' as const,
              id: r.id,
              label: `${r.firstName}${r.lastName ? ` ${r.lastName}` : ''}`,
              subtitle: `${r.employeeId} • ${r.employmentStatus}`,
              href: `/hrms/employees`,
            })),
          ),
      );
    }

    // --- INVOICES ---
    if (shouldSearchEntity('invoice', typeFilters, permittedEntities)) {
      searchPromises.push(
        db.invoice
          .findMany({
            where: {
              tenantId,
              OR: [
                { description: sc },
                { status: { contains: query } },
              ],
            },
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              dueDate: true,
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
          .then((rows) =>
            rows.map((r) => ({
              type: 'invoice' as const,
              id: r.id,
              label: `Invoice ${r.id.slice(0, 8)}`,
              subtitle: `${r.currency} ${r.amount.toLocaleString()} • ${r.status}`,
              href: `/accounting`,
            })),
          ),
      );
    }

    // --- CALLS ---
    if (shouldSearchEntity('call', typeFilters, permittedEntities)) {
      searchPromises.push(
        db.call
          .findMany({
            where: {
              tenantId,
              OR: [{ callStatus: { contains: query } }],
            },
            select: {
              id: true,
              direction: true,
              callStatus: true,
              duration: true,
              callStartTime: true,
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
          .then((rows) =>
            rows.map((r) => ({
              type: 'call' as const,
              id: r.id,
              label: `${r.direction ?? 'Call'} — ${r.callStatus ?? 'Unknown'}`,
              subtitle: r.duration ? `${Math.floor(r.duration / 60)}m ${r.duration % 60}s` : 'No duration',
              href: `/crm/calls`,
            })),
          ),
      );
    }

    // --- FIELD VISITS ---
    if (shouldSearchEntity('fieldVisit', typeFilters, permittedEntities)) {
      searchPromises.push(
        db.fieldVisit
          .findMany({
            where: {
              tenantId,
              OR: [
                { purpose: sc },
                { outcome: sc },
                { notes: sc },
              ],
            },
            select: {
              id: true,
              purpose: true,
              status: true,
              date: true,
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
          .then((rows) =>
            rows.map((r) => ({
              type: 'fieldVisit' as const,
              id: r.id,
              label: r.purpose ?? 'Field Visit',
              subtitle: r.status,
              href: `/hrms/field-sales`,
            })),
          ),
      );
    }

    // Execute all searches in parallel
    const allResultSets = await Promise.all(searchPromises);
    let allResults = allResultSets.flat();

    // Priority sort: exact matches first, then partial matches
    const lowerQuery = query.toLowerCase();
    allResults.sort((a, b) => {
      const aExact = a.label.toLowerCase() === lowerQuery ? 0 : 1;
      const bExact = b.label.toLowerCase() === lowerQuery ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;

      const aStarts = a.label.toLowerCase().startsWith(lowerQuery) ? 0 : 1;
      const bStarts = b.label.toLowerCase().startsWith(lowerQuery) ? 0 : 1;
      return aStarts - bStarts;
    });

    // Apply offset and limit
    const paginatedResults = allResults.slice(offset, offset + limit);

    // Collect unique types found
    const typesFound = [...new Set(paginatedResults.map((r) => r.type))];

    return NextResponse.json(
      success({
        query,
        results: paginatedResults,
        total: allResults.length,
        types: typesFound,
      }),
    );
  } catch (error) {
    if (isDbError(error)) return dbUnavailableResponse();
    const { statusCode, body } = handleApiError(error);
    return NextResponse.json(body, { status: statusCode });
  }
}
