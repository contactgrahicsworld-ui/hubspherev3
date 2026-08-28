'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { FollowUpFormDialog } from '@/components/crm/follow-up-form'
import {
  Plus,
  Search,
  AlertCircle,
  Clock,
  User,
  RotateCcw,
  Filter,
  Link2,
  CalendarDays,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface FollowUpOwner {
  id: string
  name: string | null
  email: string | null
}

interface FollowUp {
  id: string
  title: string
  description: string | null
  status: string | null
  followUpDate: string | null
  entityType: string | null
  entityId: string | null
  ownerId: string | null
  owner: FollowUpOwner | null
  createdAt: string
  updatedAt: string
}

interface PaginatedResponse {
  success: boolean
  data: FollowUp[]
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

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'MISSED', label: 'Missed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const STATUS_BADGE_STYLES: Record<string, string> = {
  PENDING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  MISSED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const ENTITY_ROUTE_MAP: Record<string, string> = {
  LEAD: '/crm/leads/',
  CONTACT: '/crm/contacts/',
  DEAL: '/crm/deals/',
}

// ============================================
// Helpers
// ============================================

function formatDateTime(dateStr: string) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
}

function isToday(dateStr: string): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const today = new Date()
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}

function isOverdue(fu: FollowUp): boolean {
  if (!fu.followUpDate) return false
  if (fu.status === 'COMPLETED' || fu.status === 'CANCELLED') return false
  return new Date(fu.followUpDate) < new Date()
}

function statusBadge(status: string | null) {
  const s = status ?? 'PENDING'
  return (
    <Badge variant='outline' className={STATUS_BADGE_STYLES[s] || ''}>
      {s.replace(/_/g, ' ')}
    </Badge>
  )
}

// ============================================
// Card Skeleton
// ============================================

function CardSkeleton() {
  return (
    <div className='space-y-3'>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className='p-4'>
            <div className='flex items-start justify-between gap-3'>
              <div className='flex-1 space-y-2'>
                <Skeleton className='h-5 w-3/4' />
                <Skeleton className='h-4 w-1/2' />
              </div>
              <Skeleton className='h-6 w-20' />
            </div>
            <div className='mt-3 flex gap-2'>
              <Skeleton className='h-4 w-32' />
              <Skeleton className='h-4 w-24' />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================
// Follow-up Card
// ============================================

function FollowUpCard({ fu }: { fu: FollowUp }) {
  const overdue = isOverdue(fu)

  return (
    <Card
      className={`transition-shadow hover:shadow-md ${overdue ? 'border-l-4 border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20' : ''}`}
    >
      <CardContent className='p-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0 flex-1'>
            <p className='truncate font-medium'>{fu.title}</p>
            {fu.description && (
              <p className='mt-1 line-clamp-2 text-sm text-muted-foreground'>
                {fu.description}
              </p>
            )}
          </div>
          {statusBadge(fu.status)}
        </div>

        <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
 {fu.followUpDate && (
            <span className={`flex items-center gap-1 ${overdue ? 'font-medium text-orange-600 dark:text-orange-400' : ''}`}>
              <CalendarDays className='size-3 shrink-0' />
              {formatDateTime(fu.followUpDate)}
              {overdue && ' (Overdue)'}
            </span>
          )}
          {fu.owner && (
            <span className='flex items-center gap-1'>
              <User className='size-3 shrink-0' />
              {fu.owner.name || fu.owner.email}
            </span>
          )}
          {fu.entityType && fu.entityId && (
            <span className='flex items-center gap-1'>
              <Link2 className='size-3 shrink-0' />
              <a
                href={`${ENTITY_ROUTE_MAP[fu.entityType] || ''}${fu.entityId}`}
                className='text-primary underline-offset-2 hover:underline'
                onClick={(e) => e.stopPropagation()}
              >
                {fu.entityType}
              </a>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page
// ============================================

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [statusTab, setStatusTab] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')

  // Form dialog
  const [formOpen, setFormOpen] = useState(false)

  const fetchFollowUps = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      })

      if (statusTab) params.set('status', statusTab)
      if (ownerId) params.set('ownerId', ownerId)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (search) params.set('search', search)

      const data = await apiFetch<PaginatedResponse>(`/api/v1/crm/follow-ups?${params}`)
      setFollowUps(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load follow-ups'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [page, statusTab, ownerId, dateFrom, dateTo, search])

  useEffect(() => {
    fetchFollowUps()
  }, [fetchFollowUps])

  useEffect(() => {
    setPage(1)
  }, [statusTab, ownerId, dateFrom, dateTo, search])

  const hasActiveFilters = ownerId || dateFrom || dateTo || search

  const clearFilters = () => {
    setOwnerId('')
    setDateFrom('')
    setDateTo('')
    setSearch('')
  }

  // Today's follow-ups (only on 'All' tab)
  const todaysFollowUps = useMemo(() => {
    if (statusTab) return []
    return followUps.filter((fu) => isToday(fu.followUpDate ?? ''))
  }, [followUps, statusTab])

  const otherFollowUps = useMemo(() => {
    if (statusTab) return followUps
    return followUps.filter((fu) => !isToday(fu.followUpDate ?? ''))
  }, [followUps, statusTab])

  const overdueCount = useMemo(
    () => followUps.filter((fu) => isOverdue(fu)).length,
    [followUps]
  )

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

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Follow-ups</h1>
          <p className='mt-1 text-muted-foreground'>
            Track scheduled follow-ups and reminders
          </p>
        </div>
        <Button className='min-w-[150px]' onClick={() => setFormOpen(true)}>
          <Plus className='size-4' />
          Create Follow-up
        </Button>
      </div>

      {/* Status Tabs */}
      <div className='flex gap-1 overflow-x-auto rounded-lg border bg-muted/50 p-1'>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusTab(tab.value)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              statusTab === tab.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Search follow-ups...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-9'
            aria-label='Search follow-ups'
          />
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <div className='flex items-center gap-1.5 text-sm text-muted-foreground'>
            <Filter className='size-4' />
            <span className='hidden sm:inline'>Filters:</span>
          </div>

          <Input
            type='date'
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className='w-[150px]'
            aria-label='Date from'
          />

          <Input
            type='date'
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className='w-[150px]'
            aria-label='Date to'
          />

          {hasActiveFilters && (
            <Button variant='ghost' size='sm' onClick={clearFilters}>
              <RotateCcw className='size-3' />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Overdue notice */}
      {overdueCount > 0 && (
        <div className='flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-400'>
          <AlertCircle className='size-4 shrink-0' />
          <span>
            {overdueCount} overdue {overdueCount === 1 ? 'follow-up' : 'follow-ups'} need attention
          </span>
        </div>
      )}

      {/* Loading State */}
      {loading && <CardSkeleton />}

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
              onClick={fetchFollowUps}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && followUps.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Clock className='mb-3 size-10 text-muted-foreground/50' />
            <p className='text-sm font-medium text-muted-foreground'>No follow-ups found</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              {statusTab || hasActiveFilters
                ? 'Try adjusting your filters.'
                : 'Schedule your first follow-up to get started.'}
            </p>
            {!statusTab && !hasActiveFilters && (
              <Button className='mt-4' size='sm' onClick={() => setFormOpen(true)}>
                <Plus className='size-4' />
                Create Follow-up
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Today's Follow-ups Section */}
      {!loading && !error && todaysFollowUps.length > 0 && (
        <div className='space-y-3'>
          <Card className='border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20'>
            <CardHeader className='pb-2'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <CalendarDays className='size-4 text-amber-600 dark:text-amber-400' />
                Today&apos;s Follow-ups
                <Badge variant='secondary' className='ml-1'>{todaysFollowUps.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-3 pt-0'>
              {todaysFollowUps.map((fu) => (
                <FollowUpCard key={fu.id} fu={fu} />
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Other Follow-ups */}
      {!loading && !error && otherFollowUps.length > 0 && (
        <>
          <div className='space-y-3'>
            {otherFollowUps.map((fu) => (
              <FollowUpCard key={fu.id} fu={fu} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>
                Showing {followUps.length} of {total} follow-ups
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

      <FollowUpFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={fetchFollowUps}
      />
    </div>
  )
}
