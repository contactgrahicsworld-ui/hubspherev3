'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
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
import { LeadFormDialog } from '@/components/crm/lead-form'
import { LEAD_SOURCES, PRIORITIES, LEAD_STATUSES } from '@/lib/constants'
import {
  Plus,
  Search,
  Filter,
  AlertCircle,
  Users,
  Mail,
  Phone,
  Building,
  RotateCcw,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface LeadOwner {
  id: string
  name: string | null
  email: string | null
}

interface Lead {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
  mobile: string | null
  company: string | null
  source: string | null
  status: string | null
  priority: string | null
  ownerId: string | null
  owner: LeadOwner | null
  value: number | null
  description: string | null
  convertedToContactId: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

interface PaginatedResponse {
  success: boolean
  data: Lead[]
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

const STATUS_BADGE_STYLES: Record<string, string> = {
  NEW: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  CONTACTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  QUALIFIED: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  PROPOSAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  NEGOTIATION: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  WON: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  LOST: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CONVERTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const PRIORITY_BADGE_STYLES: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: 'Website',
  REFERRAL: 'Referral',
  LINKEDIN: 'LinkedIn',
  COLD_CALL: 'Cold Call',
  EMAIL_CAMPAIGN: 'Email Campaign',
  ADVERTISEMENT: 'Advertisement',
  TRADE_SHOW: 'Trade Show',
  SOCIAL_MEDIA: 'Social Media',
  OTHER: 'Other',
}

const SORT_OPTIONS = [
  { value: 'createdAt-desc', label: 'Newest First' },
  { value: 'createdAt-asc', label: 'Oldest First' },
  { value: 'updatedAt-desc', label: 'Recently Updated' },
  { value: 'firstName-asc', label: 'Name A-Z' },
  { value: 'firstName-desc', label: 'Name Z-A' },
  { value: 'value-desc', label: 'Highest Value' },
  { value: 'value-asc', label: 'Lowest Value' },
  { value: 'priority-desc', label: 'Highest Priority' },
  { value: 'priority-asc', label: 'Lowest Priority' },
]

// ============================================
// Helpers
// ============================================

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return '-'
  }
}

function formatCurrency(val: number | null): string {
  if (val == null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val)
}

function getLeadName(lead: Lead): string {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '-'
}

function statusBadge(status: string | null) {
  const s = status ?? 'NEW'
  return (
    <Badge variant='outline' className={STATUS_BADGE_STYLES[s] || ''}>
      {s}
    </Badge>
  )
}

function priorityBadge(priority: string | null) {
  const p = priority ?? 'MEDIUM'
  return (
    <Badge variant='outline' className={PRIORITY_BADGE_STYLES[p] || ''}>
      {p}
    </Badge>
  )
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
              {Array.from({ length: 8 }).map((_, i) => (
                <TableHead key={i}><Skeleton className='h-4 w-20' /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 8 }).map((_, j) => (
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
// Mobile Card
// ============================================

function MobileLeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
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
            <p className='truncate font-medium'>{getLeadName(lead)}</p>
            {lead.company && (
              <p className='mt-0.5 truncate text-xs text-muted-foreground'>{lead.company}</p>
            )}
          </div>
          <div className='flex shrink-0 flex-col items-end gap-1'>
            {statusBadge(lead.status)}
            {lead.value != null && lead.value > 0 && (
              <span className='text-xs font-medium text-muted-foreground'>
                {formatCurrency(lead.value)}
              </span>
            )}
          </div>
        </div>

        <div className='mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
          {lead.email && (
            <span className='flex items-center gap-1 truncate'>
              <Mail className='size-3 shrink-0' />{lead.email}
            </span>
          )}
          {lead.mobile && (
            <span className='flex items-center gap-1 truncate'>
              <Phone className='size-3 shrink-0' />{lead.mobile}
            </span>
          )}
          {priorityBadge(lead.priority)}
        </div>

        <div className='mt-2 flex items-center justify-between text-xs text-muted-foreground'>
          <span>{SOURCE_LABELS[lead.source ?? ''] || lead.source || '-'}</span>
          <span>{formatDate(lead.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page
// ============================================

export default function LeadsListPage() {
  const router = useRouter()

  // Data state
  const [leads, setLeads] = useState<Lead[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const [priority, setPriority] = useState('')
  const [sort, setSort] = useState('createdAt-desc')

  // Form dialog
  const [formOpen, setFormOpen] = useState(false)

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [sortBy, sortOrder] = sort.split('-')
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        sortBy,
        sortOrder,
      })

      if (debouncedSearch) params.set('search', debouncedSearch)
      if (status) params.set('status', status)
      if (source) params.set('source', source)
      if (priority) params.set('priority', priority)

      const data = await apiFetch<PaginatedResponse>(`/api/v1/crm/leads?${params}`)
      setLeads(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load leads'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, status, source, priority, sort])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status, source, priority, sort])

  // Pagination helper
  const renderPageNumbers = () => {
    const pages: number[] = []
    const maxVisible = 5
    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    return pages
  }

  const hasActiveFilters = search || status || source || priority

  const clearFilters = () => {
    setSearch('')
    setStatus('')
    setSource('')
    setPriority('')
    setSort('createdAt-desc')
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Leads</h1>
          <p className='text-muted-foreground mt-1'>
            Manage and track your sales leads
          </p>
        </div>
        <Button className='min-w-[130px]' onClick={() => setFormOpen(true)}>
          <Plus className='size-4' />
          Create Lead
        </Button>
      </div>

      {/* Search and Filters */}
      <div className='flex flex-col gap-3'>
        {/* Search Bar */}
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Search by name, email, mobile, or company...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-9'
            aria-label='Search leads'
          />
        </div>

        {/* Filter Row */}
        <div className='flex flex-wrap items-center gap-2'>
          <div className='flex items-center gap-1.5 text-sm text-muted-foreground'>
            <Filter className='size-4' />
            <span className='hidden sm:inline'>Filters:</span>
          </div>

          <Select value={status} onValueChange={(v) => setStatus(v === '_all' ? '' : v)}>
            <SelectTrigger className='w-[130px]' aria-label='Filter by status'>
              <SelectValue placeholder='All Statuses' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='_all'>All Statuses</SelectItem>
              {Object.values(LEAD_STATUSES).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={source} onValueChange={(v) => setSource(v === '_all' ? '' : v)}>
            <SelectTrigger className='w-[130px]' aria-label='Filter by source'>
              <SelectValue placeholder='All Sources' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='_all'>All Sources</SelectItem>
              {Object.values(LEAD_SOURCES).map((s) => (
                <SelectItem key={s} value={s}>{SOURCE_LABELS[s] || s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priority} onValueChange={(v) => setPriority(v === '_all' ? '' : v)}>
            <SelectTrigger className='w-[130px]' aria-label='Filter by priority'>
              <SelectValue placeholder='All Priorities' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='_all'>All Priorities</SelectItem>
              {Object.values(PRIORITIES).map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className='w-[160px]' aria-label='Sort by'>
              <SelectValue placeholder='Sort by' />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant='ghost' size='sm' onClick={clearFilters}>
              <RotateCcw className='size-3' />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && <TableSkeleton />}

      {/* Error State */}
      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 shrink-0 text-destructive' />
            <p className='text-sm text-destructive'>{error}</p>
            <Button
              variant='outline'
              size='sm'
              className='ml-auto shrink-0'
              onClick={fetchLeads}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && leads.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Users className='mb-3 size-10 text-muted-foreground/50' />
            <p className='text-sm font-medium text-muted-foreground'>No leads yet</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              {hasActiveFilters
                ? 'Try adjusting your filters.'
                : 'Create your first lead to get started.'}
            </p>
            {!hasActiveFilters && (
              <Button className='mt-4' size='sm' onClick={() => setFormOpen(true)}>
                <Plus className='size-4' />
                Create Lead
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Desktop Table */}
      {!loading && !error && leads.length > 0 && (
        <>
          <Card className='hidden md:block'>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='min-w-[160px]'>Name</TableHead>
                    <TableHead className='min-w-[180px]'>Email</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className='text-right'>Value</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className='cursor-pointer'
                      onClick={() => router.push(`/crm/leads/${lead.id}`)}
                    >
                      <TableCell className='font-medium'>
                        {getLeadName(lead)}
                      </TableCell>
                      <TableCell className='max-w-[200px] truncate text-muted-foreground'>
                        {lead.email || '-'}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {lead.mobile || '-'}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {lead.company || '-'}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {SOURCE_LABELS[lead.source ?? ''] || lead.source || '-'}
                      </TableCell>
                      <TableCell>{statusBadge(lead.status)}</TableCell>
                      <TableCell>{priorityBadge(lead.priority)}</TableCell>
                      <TableCell className='text-muted-foreground'>
                        {lead.owner?.name || '-'}
                      </TableCell>
                      <TableCell className='text-right font-medium'>
                        {formatCurrency(lead.value)}
                      </TableCell>
                      <TableCell className='whitespace-nowrap text-xs text-muted-foreground'>
                        {formatDate(lead.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Cards */}
          <div className='flex flex-col gap-3 md:hidden'>
            {leads.map((lead) => (
              <MobileLeadCard
                key={lead.id}
                lead={lead}
                onClick={() => router.push(`/crm/leads/${lead.id}`)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>
                Showing {leads.length} of {total} leads
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href='#'
                      onClick={(e) => {
                        e.preventDefault()
                        if (page > 1) setPage(page - 1)
                      }}
                      aria-disabled={page <= 1}
                      className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                  {renderPageNumbers().map((p) => (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href='#'
                        isActive={p === page}
                        onClick={(e) => {
                          e.preventDefault()
                          setPage(p)
                        }}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href='#'
                      onClick={(e) => {
                        e.preventDefault()
                        if (page < totalPages) setPage(page + 1)
                      }}
                      aria-disabled={page >= totalPages}
                      className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}

      {/* Lead Form Dialog */}
      <LeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={fetchLeads}
      />
    </div>
  )
}
