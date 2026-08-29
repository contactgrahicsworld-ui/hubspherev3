'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DealFormDialog } from '@/components/crm/deal-form'
import { DEAL_STAGES } from '@/lib/constants'
import {
  Plus,
  Search,
  Filter,
  AlertCircle,
  DollarSign,
  RotateCcw,
  LayoutGrid,
  List,
  Mail,
  Building2,
  User,
  CalendarDays,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface DealOwner {
  id: string
  name: string | null
  email: string | null
}

interface DealContact {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
}

interface DealCompany {
  id: string
  name: string
  industry: string | null
}

interface Deal {
  id: string
  title: string
  value: number
  currency: string | null
  stage: string
  probability: number | null
  expectedCloseDate: string | null
  contactId: string | null
  contact: DealContact | null
  companyId: string | null
  company: DealCompany | null
  ownerId: string | null
  owner: DealOwner | null
  lostReason: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

interface UserOption {
  id: string
  name: string
  email: string
}

interface ContactOption {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
}

interface CompanyOption {
  id: string
  name: string
}

interface PaginatedResponse {
  success: boolean
  data: Deal[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ============================================
// Constants
// ============================================

const STAGE_BADGE_STYLES: Record<string, string> = {
  NEW: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  QUALIFIED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PROPOSAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  NEGOTIATION: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  WON: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  LOST: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const STAGE_BORDER_STYLES: Record<string, string> = {
  NEW: 'border-t-indigo-500',
  QUALIFIED: 'border-t-blue-500',
  PROPOSAL: 'border-t-amber-500',
  NEGOTIATION: 'border-t-orange-500',
  WON: 'border-t-green-500',
  LOST: 'border-t-red-500',
}

const SORT_OPTIONS = [
  { value: 'createdAt-desc', label: 'Newest First' },
  { value: 'createdAt-asc', label: 'Oldest First' },
  { value: 'updatedAt-desc', label: 'Recently Updated' },
  { value: 'title-asc', label: 'Title A-Z' },
  { value: 'value-desc', label: 'Highest Value' },
  { value: 'value-asc', label: 'Lowest Value' },
  { value: 'expectedCloseDate-asc', label: 'Close Date Soonest' },
]

// ============================================
// Helpers
// ============================================

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return '-' }
}

function formatCurrency(val: number, currency?: string | null): string {
  if (val == null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency || 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(val)
}

function stageBadge(stage: string) {
  return <Badge variant='outline' className={STAGE_BADGE_STYLES[stage] || ''}>{stage}</Badge>
}

// ============================================
// Table Skeleton
// ============================================

function TableSkeleton() {
  return (
    <Card>
      <CardContent className='p-0'>
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 9 }).map((_, i) => (
                <TableHead key={i}><Skeleton className='h-4 w-20' /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 9 }).map((_, j) => (
                  <TableCell key={j}><Skeleton className='h-4 w-full' /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ============================================
// Kanban Skeleton
// ============================================

function KanbanSkeleton() {
  return (
    <div className='grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6'>
      {DEAL_STAGES.map((stage) => (
        <div key={stage.key} className='space-y-3'>
          <Skeleton className='h-6 w-24' />
          <div className='space-y-2'>
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className='h-24 rounded-lg' />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================
// Mobile Deal Card
// ============================================

function MobileDealCard({ deal, onClick }: { deal: Deal; onClick: () => void }) {
  return (
    <Card
      className='cursor-pointer transition-shadow hover:shadow-md'
      onClick={onClick}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
    >
      <CardContent className='p-4'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0 flex-1'>
            <p className='truncate font-medium'>{deal.title}</p>
            <p className='mt-0.5 text-sm font-medium'>{formatCurrency(deal.value, deal.currency)}</p>
          </div>
          {stageBadge(deal.stage)}
        </div>
        <div className='mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
          {deal.contact && (
            <span className='flex items-center gap-1 truncate'>
              <User className='size-3 shrink-0' />{[deal.contact.firstName, deal.contact.lastName].filter(Boolean).join(' ')}
            </span>
          )}
          {deal.company && (
            <span className='flex items-center gap-1 truncate'>
              <Building2 className='size-3 shrink-0' />{deal.company.name}
            </span>
          )}
        </div>
        <div className='mt-2 flex items-center justify-between text-xs text-muted-foreground'>
          <span>{deal.owner?.name || 'Unassigned'}</span>
          {deal.probability != null && <span>{deal.probability}%</span>}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Kanban Card
// ============================================

function KanbanDealCard({ deal, onClick }: { deal: Deal; onClick: () => void }) {
  return (
    <div
      className='cursor-pointer rounded-lg border p-3 transition-shadow hover:shadow-md'
      onClick={onClick}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
    >
      <p className='truncate text-sm font-medium'>{deal.title}</p>
      <p className='mt-1 text-sm font-medium'>{formatCurrency(deal.value, deal.currency)}</p>
      <div className='mt-2 flex items-center justify-between text-xs text-muted-foreground'>
        <span className='truncate'>{deal.contact ? [deal.contact.firstName, deal.contact.lastName].filter(Boolean).join(' ') : deal.company?.name || '-'}</span>
        {deal.probability != null && <span className='shrink-0'>{deal.probability}%</span>}
      </div>
      {deal.expectedCloseDate && (
        <p className='mt-1 flex items-center gap-1 text-xs text-muted-foreground'>
          <CalendarDays className='size-3' />{formatDate(deal.expectedCloseDate)}
        </p>
      )}
    </div>
  )
}

// ============================================
// Main Page
// ============================================

export default function DealsListPage() {
  const router = useRouter()

  const [deals, setDeals] = useState<Deal[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stage, setStage] = useState('')
  const [contactId, setContactId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [sort, setSort] = useState('createdAt-desc')

  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table')
  const [formOpen, setFormOpen] = useState(false)

  // Filter options
  const [users, setUsers] = useState<UserOption[]>([])
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [companies, setCompanies] = useState<CompanyOption[]>([])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  // Fetch filter options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [usersRes, contactsRes, companiesRes] = await Promise.all([
          apiFetch<{ success: boolean; data: UserOption[] }>('/api/v1/admin/users?limit=100'),
          apiFetch<{ success: boolean; data: ContactOption[] }>('/api/v1/crm/contacts?limit=100'),
          apiFetch<{ success: boolean; data: CompanyOption[] }>('/api/v1/crm/companies?limit=100'),
        ])
        setUsers(usersRes.data ?? [])
        setContacts(contactsRes.data ?? [])
        setCompanies(companiesRes.data ?? [])
      } catch { /* silent */ }
    }
    fetchOptions()
  }, [])

  // For Kanban view, fetch all deals (limit=200)
  const [allDeals, setAllDeals] = useState<Deal[]>([])
  const [loadingKanban, setLoadingKanban] = useState(false)

  const fetchDeals = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [sortBy, sortOrder] = sort.split('-')
      const params = new URLSearchParams({ page: String(page), limit: '20', sortBy, sortOrder })

      if (debouncedSearch) params.set('search', debouncedSearch)
      if (stage) params.set('stage', stage)
      if (contactId) params.set('contactId', contactId)
      if (companyId) params.set('companyId', companyId)
      if (ownerId) params.set('ownerId', ownerId)

      const data = await apiFetch<PaginatedResponse>(`/api/v1/crm/deals?${params}`)
      setDeals(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load deals'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, stage, contactId, companyId, ownerId, sort])

  const fetchAllDeals = useCallback(async () => {
    setLoadingKanban(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (contactId) params.set('contactId', contactId)
      if (companyId) params.set('companyId', companyId)
      if (ownerId) params.set('ownerId', ownerId)
      const data = await apiFetch<PaginatedResponse>(`/api/v1/crm/deals?${params}`)
      setAllDeals(data.data)
    } catch { /* silent */ } finally {
      setLoadingKanban(false)
    }
  }, [debouncedSearch, contactId, companyId, ownerId])

  useEffect(() => { fetchDeals() }, [fetchDeals])
  useEffect(() => {
    if (viewMode === 'kanban') fetchAllDeals()
  }, [viewMode, fetchAllDeals])

  useEffect(() => { setPage(1) }, [debouncedSearch, stage, contactId, companyId, ownerId, sort])

  const renderPageNumbers = () => {
    const pages: number[] = []
    const maxVisible = 5
    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  const hasActiveFilters = search || stage || contactId || companyId || ownerId
  const clearFilters = () => {
    setSearch(''); setStage(''); setContactId(''); setCompanyId(''); setOwnerId(''); setSort('createdAt-desc')
  }

  // Group deals by stage for Kanban
  const dealsByStage = DEAL_STAGES.map((s) => ({
    ...s,
    deals: allDeals.filter((d) => d.stage === s.key),
  }))

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Deals</h1>
          <p className='text-muted-foreground mt-1'>Manage your sales pipeline</p>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size='icon'
            onClick={() => setViewMode('table')}
            aria-label='Table view'
          >
            <List className='size-4' />
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            size='icon'
            onClick={() => setViewMode('kanban')}
            aria-label='Kanban view'
          >
            <LayoutGrid className='size-4' />
          </Button>
          <Button className='min-w-[130px]' onClick={() => setFormOpen(true)}>
            <Plus className='size-4' /> Create Deal
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Search deals...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-9'
            aria-label='Search deals'
          />
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <div className='flex items-center gap-1.5 text-sm text-muted-foreground'>
            <Filter className='size-4' />
            <span className='hidden sm:inline'>Filters:</span>
          </div>

          <Select value={stage} onValueChange={(v) => setStage(v === '_all' ? '' : v)}>
            <SelectTrigger className='w-[140px]' aria-label='Filter by stage'>
              <SelectValue placeholder='All Stages' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='_all'>All Stages</SelectItem>
              {DEAL_STAGES.map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={contactId} onValueChange={(v) => setContactId(v === '_all' ? '' : v)}>
            <SelectTrigger className='w-[150px]' aria-label='Filter by contact'>
              <SelectValue placeholder='All Contacts' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='_all'>All Contacts</SelectItem>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>{[c.firstName, c.lastName].filter(Boolean).join(' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={companyId} onValueChange={(v) => setCompanyId(v === '_all' ? '' : v)}>
            <SelectTrigger className='w-[150px]' aria-label='Filter by company'>
              <SelectValue placeholder='All Companies' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='_all'>All Companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {viewMode === 'table' && (
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className='w-[160px]' aria-label='Sort by'>
                <SelectValue placeholder='Sort by' />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasActiveFilters && (
            <Button variant='ghost' size='sm' onClick={clearFilters}>
              <RotateCcw className='size-3' /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* ============================================
          TABLE VIEW
      ============================================ */}
      {viewMode === 'table' && (
        <>
          {loading && <TableSkeleton />}

          {error && !loading && (
            <Card className='border-destructive/50'>
              <CardContent className='flex items-center gap-3 py-6'>
                <AlertCircle className='size-5 shrink-0 text-destructive' />
                <p className='text-sm text-destructive'>{error}</p>
                <Button variant='outline' size='sm' className='ml-auto shrink-0' onClick={fetchDeals}>Retry</Button>
              </CardContent>
            </Card>
          )}

          {!loading && !error && deals.length === 0 && (
            <Card>
              <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
                <DollarSign className='mb-3 size-10 text-muted-foreground/50' />
                <p className='text-sm font-medium text-muted-foreground'>No deals yet</p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  {hasActiveFilters ? 'Try adjusting your filters.' : 'Create your first deal to get started.'}
                </p>
                {!hasActiveFilters && (
                  <Button className='mt-4' size='sm' onClick={() => setFormOpen(true)}>
                    <Plus className='size-4' /> Create Deal
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {!loading && !error && deals.length > 0 && (
            <>
              <Card className='hidden md:block'>
                <CardContent className='p-0'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className='min-w-[180px]'>Title</TableHead>
                        <TableHead className='text-right'>Value</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead className='text-center'>Prob %</TableHead>
                        <TableHead>Expected Close</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deals.map((deal) => (
                        <TableRow
                          key={deal.id}
                          className='cursor-pointer'
                          onClick={() => router.push(`/crm/deals/${deal.id}`)}
                        >
                          <TableCell className='font-medium'>{deal.title}</TableCell>
                          <TableCell className='text-right font-medium'>{formatCurrency(deal.value, deal.currency)}</TableCell>
                          <TableCell>{stageBadge(deal.stage)}</TableCell>
                          <TableCell className='max-w-[150px] truncate text-muted-foreground'>
                            {deal.contact ? [deal.contact.firstName, deal.contact.lastName].filter(Boolean).join(' ') : '-'}
                          </TableCell>
                          <TableCell className='max-w-[150px] truncate text-muted-foreground'>
                            {deal.company?.name || '-'}
                          </TableCell>
                          <TableCell className='text-muted-foreground'>{deal.owner?.name || '-'}</TableCell>
                          <TableCell className='text-center'>{deal.probability != null ? `${deal.probability}%` : '-'}</TableCell>
                          <TableCell className='whitespace-nowrap text-xs text-muted-foreground'>{formatDate(deal.expectedCloseDate ?? '')}</TableCell>
                          <TableCell className='whitespace-nowrap text-xs text-muted-foreground'>{formatDate(deal.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Mobile Cards */}
              <div className='flex flex-col gap-3 md:hidden'>
                {deals.map((deal) => (
                  <MobileDealCard key={deal.id} deal={deal} onClick={() => router.push(`/crm/deals/${deal.id}`)} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className='flex flex-col items-center gap-2'>
                  <p className='text-xs text-muted-foreground'>Showing {deals.length} of {total} deals</p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href='#' onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1) }}
                          aria-disabled={page <= 1} className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      {renderPageNumbers().map((p) => (
                        <PaginationItem key={p}>
                          <PaginationLink href='#' isActive={p === page} onClick={(e) => { e.preventDefault(); setPage(p) }}>{p}</PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href='#' onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1) }}
                          aria-disabled={page >= totalPages} className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ============================================
          KANBAN VIEW
      ============================================ */}
      {viewMode === 'kanban' && (
        <>
          {loadingKanban && <KanbanSkeleton />}

          {!loadingKanban && allDeals.length === 0 && (
            <Card>
              <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
                <DollarSign className='mb-3 size-10 text-muted-foreground/50' />
                <p className='text-sm font-medium text-muted-foreground'>No deals yet</p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  {hasActiveFilters ? 'Try adjusting your filters.' : 'Create your first deal to get started.'}
                </p>
                {!hasActiveFilters && (
                  <Button className='mt-4' size='sm' onClick={() => setFormOpen(true)}>
                    <Plus className='size-4' /> Create Deal
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {!loadingKanban && allDeals.length > 0 && (
            <div className='grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6'>
              {dealsByStage.map((col) => (
                <div key={col.key} className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <div className='size-2 rounded-full' style={{ backgroundColor: col.color }} />
                      <span className='text-sm font-medium'>{col.label}</span>
                    </div>
                    <span className='text-xs text-muted-foreground'>{col.deals.length}</span>
                  </div>
                  <div className={`max-h-[60vh] space-y-2 overflow-y-auto border-t-2 pt-2 ${STAGE_BORDER_STYLES[col.key] || ''}`}>
                    {col.deals.length === 0 ? (
                      <p className='py-4 text-center text-xs text-muted-foreground'>No deals</p>
                    ) : (
                      col.deals.map((deal) => (
                        <KanbanDealCard key={deal.id} deal={deal} onClick={() => router.push(`/crm/deals/${deal.id}`)} />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <DealFormDialog open={formOpen} onOpenChange={setFormOpen} onSuccess={() => { fetchDeals(); fetchAllDeals() }} />
    </div>
  )
}
