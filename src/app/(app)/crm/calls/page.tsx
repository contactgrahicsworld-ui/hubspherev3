'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
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
import { CALL_STATUSES, RECORDING_STATUSES } from '@/lib/constants'
import {
  Search,
  AlertCircle,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  RotateCcw,
  Filter,
  PhoneCall,
  Clock,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface CallAgent {
  id: string
  name: string | null
  email: string | null
}

interface Call {
  id: string
  direction: string | null
  callStatus: string | null
  callType: string | null
  duration: number | null
  contactInfo: string | null
  recordingStatus: string | null
  agentId: string | null
  agent: CallAgent | null
  leadId: string | null
  followUpId: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface PaginatedResponse {
  success: boolean
  data: Call[]
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

const RECORDING_BADGE_STYLES: Record<string, string> = {
  READY: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  PROCESSING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  NOT_AVAILABLE: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  RECORDING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

const RECORDING_LABELS: Record<string, string> = {
  READY: 'Available',
  PROCESSING: 'Processing',
  NOT_AVAILABLE: 'N/A',
  FAILED: 'Failed',
  RECORDING: 'Recording',
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  RINGING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  CONNECTED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ENDED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  MISSED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  QUEUED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

const DIRECTION_LABELS: Record<string, string> = {
  INBOUND: 'Inbound',
  OUTBOUND: 'Outbound',
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

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '-'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function recordingBadge(status: string | null) {
  const s = status ?? 'NOT_AVAILABLE'
  return (
    <Badge variant='outline' className={RECORDING_BADGE_STYLES[s] || ''}>
      {RECORDING_LABELS[s] || s}
    </Badge>
  )
}

function statusBadge(status: string | null) {
  const s = status ?? 'UNKNOWN'
  return (
    <Badge variant='outline' className={STATUS_BADGE_STYLES[s] || ''}>
      {s}
    </Badge>
  )
}

function DirectionIcon({ direction }: { direction: string | null }) {
  if (direction === 'OUTBOUND') {
    return <PhoneOutgoing className='size-4 text-blue-600 dark:text-blue-400' />
  }
  if (direction === 'INBOUND') {
    return <PhoneIncoming className='size-4 text-green-600 dark:text-green-400' />
  }
  return <Phone className='size-4 text-muted-foreground' />
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
// Mobile Card
// ============================================

function MobileCallCard({ call }: { call: Call }) {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex items-center gap-2'>
            <DirectionIcon direction={call.direction} />
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium'>
                {call.contactInfo || 'Unknown'}
              </p>
              <p className='truncate text-xs text-muted-foreground'>
                {call.agent?.name || call.agent?.email || '-'}
              </p>
            </div>
          </div>
          {statusBadge(call.callStatus)}
        </div>

        <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
          <span>{formatDateTime(call.createdAt)}</span>
          <span>{formatDuration(call.duration)}</span>
          {call.recordingStatus && recordingBadge(call.recordingStatus)}
        </div>

        {call.notes && (
          <p className='mt-2 line-clamp-1 text-xs text-muted-foreground'>{call.notes}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page
// ============================================

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [direction, setDirection] = useState('')
  const [callStatus, setCallStatus] = useState('')
  const [agentId, setAgentId] = useState('')
  const [recordingStatus, setRecordingStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')

  const fetchCalls = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      })

      if (direction) params.set('direction', direction)
      if (callStatus) params.set('callStatus', callStatus)
      if (agentId) params.set('agentId', agentId)
      if (recordingStatus) params.set('recordingStatus', recordingStatus)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (search) params.set('search', search)

      const data = await apiFetch<PaginatedResponse>(`/api/v1/crm/calls?${params}`)
      setCalls(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load calls'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [page, direction, callStatus, agentId, recordingStatus, dateFrom, dateTo, search])

  useEffect(() => {
    fetchCalls()
  }, [fetchCalls])

  useEffect(() => {
    setPage(1)
  }, [direction, callStatus, agentId, recordingStatus, dateFrom, dateTo, search])

  const hasActiveFilters = direction || callStatus || agentId || recordingStatus || dateFrom || dateTo || search

  const clearFilters = () => {
    setDirection('')
    setCallStatus('')
    setAgentId('')
    setRecordingStatus('')
    setDateFrom('')
    setDateTo('')
    setSearch('')
  }

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
          <h1 className='text-2xl font-bold tracking-tight'>Call History</h1>
          <p className='mt-1 text-muted-foreground'>
            View and manage all call records
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Search by contact info, agent...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-9'
            aria-label='Search calls'
          />
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <div className='flex items-center gap-1.5 text-sm text-muted-foreground'>
            <Filter className='size-4' />
            <span className='hidden sm:inline'>Filters:</span>
          </div>

          <Select value={direction} onValueChange={(v) => setDirection(v === '_all' ? '' : v)}>
            <SelectTrigger className='w-[130px]' aria-label='Filter by direction'>
              <SelectValue placeholder='Direction' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='_all'>All</SelectItem>
              <SelectItem value='INBOUND'>Inbound</SelectItem>
              <SelectItem value='OUTBOUND'>Outbound</SelectItem>
            </SelectContent>
          </Select>

          <Select value={callStatus} onValueChange={(v) => setCallStatus(v === '_all' ? '' : v)}>
            <SelectTrigger className='w-[130px]' aria-label='Filter by status'>
              <SelectValue placeholder='All Statuses' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='_all'>All Statuses</SelectItem>
              {Object.values(CALL_STATUSES).map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={recordingStatus} onValueChange={(v) => setRecordingStatus(v === '_all' ? '' : v)}>
            <SelectTrigger className='w-[140px]' aria-label='Filter by recording'>
              <SelectValue placeholder='Recording' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='_all'>All</SelectItem>
              {Object.values(RECORDING_STATUSES).map((s) => (
                <SelectItem key={s} value={s}>
                  {RECORDING_LABELS[s] || s.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
              onClick={fetchCalls}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && calls.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <PhoneCall className='mb-3 size-10 text-muted-foreground/50' />
            <p className='text-sm font-medium text-muted-foreground'>No calls found</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              {hasActiveFilters
                ? 'Try adjusting your filters.'
                : 'Call records will appear here.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Desktop Table */}
      {!loading && !error && calls.length > 0 && (
        <>
          <Card className='hidden md:block'>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='min-w-[60px]'>Dir</TableHead>
                    <TableHead className='min-w-[160px]'>Customer</TableHead>
                    <TableHead className='min-w-[140px]'>Agent</TableHead>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recording</TableHead>
                    <TableHead>Follow-up</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>
                        <DirectionIcon direction={call.direction} />
                        <span className='ml-1 text-xs text-muted-foreground'>
                          {DIRECTION_LABELS[call.direction || ''] || call.direction || '-'}
                        </span>
                      </TableCell>
                      <TableCell className='max-w-[200px] truncate font-medium'>
                        {call.contactInfo || '-'}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {call.agent?.name || call.agent?.email || '-'}
                      </TableCell>
                      <TableCell className='whitespace-nowrap text-xs text-muted-foreground'>
                        {formatDateTime(call.createdAt)}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {formatDuration(call.duration)}
                      </TableCell>
                      <TableCell>{statusBadge(call.callStatus)}</TableCell>
                      <TableCell>{recordingBadge(call.recordingStatus)}</TableCell>
                      <TableCell className='text-muted-foreground'>
                        {call.followUpId ? (
                          <Badge variant='secondary' className='text-xs'>Scheduled</Badge>
                        ) : (
                          <span className='text-xs'>-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Cards */}
          <div className='flex flex-col gap-3 md:hidden'>
            {calls.map((call) => (
              <MobileCallCard key={call.id} call={call} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>
                Showing {calls.length} of {total} calls
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
    </div>
  )
}
