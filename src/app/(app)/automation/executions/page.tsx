'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  Activity,
  Filter,
  AlertCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================
// Types
// ============================================

interface Execution {
  id: string
  workflowId: string
  status: string
  triggerEvent: string
  entityType: string | null
  entityId: string | null
  error: string | null
  startedAt: string
  completedAt: string | null
  triggeredBy: { id: string; name: string | null; email: string | null } | null
  workflow: { id: string; name: string; triggerType: string }
  _count: { logs: number }
}

interface ExecutionLog {
  id: string
  level: string
  message: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

interface PaginatedResponse {
  success: boolean
  data: Execution[]
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

const TRIGGER_EVENT_LABELS: Record<string, string> = {
  'lead.created': 'Lead Created',
  'lead.updated': 'Lead Updated',
  'lead.assigned': 'Lead Assigned',
  'lead.status_changed': 'Lead Status Changed',
  'deal.created': 'Deal Created',
  'deal.stage_changed': 'Deal Stage Changed',
  'deal.won': 'Deal Won',
  'deal.lost': 'Deal Lost',
  'task.created': 'Task Created',
  'task.completed': 'Task Completed',
  'followup.due': 'Follow-up Due',
  'followup.overdue': 'Follow-up Overdue',
  'call.completed': 'Call Completed',
  'employee.created': 'Employee Created',
  'leave.requested': 'Leave Requested',
  'leave.approved': 'Leave Approved',
  'attendance.checkin': 'Attendance Check-in',
  'attendance.checkout': 'Attendance Check-out',
  'expense.submitted': 'Expense Submitted',
  'expense.approved': 'Expense Approved',
}

const EXECUTION_STATUS_STYLES: Record<string, string> = {
  RUNNING: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-muted text-muted-foreground',
}

const STATUS_FILTER_OPTIONS = ['ALL', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']

const LOG_LEVEL_STYLES: Record<string, string> = {
  DEBUG: 'text-muted-foreground',
  INFO: 'text-sky-600 dark:text-sky-400',
  WARN: 'text-amber-600 dark:text-amber-400',
  ERROR: 'text-red-600 dark:text-red-400',
}

// ============================================
// Helpers
// ============================================

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return '—'
  }
}

function formatDuration(started: string, completed: string | null): string {
  if (!completed) return '—'
  try {
    const ms = new Date(completed).getTime() - new Date(started).getTime()
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
  } catch {
    return '—'
  }
}

// ============================================
// Sub-Components
// ============================================

function TableSkeleton() {
  return (
    <Card>
      <CardContent className='p-0'>
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 7 }).map((_, i) => (
                <TableHead key={i}><Skeleton className='h-4 w-20' /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 7 }).map((_, j) => (
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

function MobileExecutionCard({
  exec,
  expanded,
  onToggle,
  logs,
  logsLoading,
}: {
  exec: Execution
  expanded: boolean
  onToggle: () => void
  logs: ExecutionLog[]
  logsLoading: boolean
}) {

  return (
    <Card>
      <CardContent className='p-4'>
        <button
          className='flex w-full items-start justify-between gap-2 text-left'
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <div className='min-w-0 flex-1 space-y-1.5'>
            <div className='flex items-center gap-2'>
              <Badge
                variant='outline'
                className={cn('shrink-0 text-[10px]', EXECUTION_STATUS_STYLES[exec.status] ?? '')}
              >
                {exec.status}
              </Badge>
              <span className='truncate text-sm font-medium'>{exec.workflow.name}</span>
            </div>
            <div className='flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground'>
              <span>{TRIGGER_EVENT_LABELS[exec.triggerEvent] ?? exec.triggerEvent}</span>
              {exec.entityType && <span>{exec.entityType}</span>}
            </div>
            <p className='text-xs text-muted-foreground'>{formatDateTime(exec.startedAt)}</p>
            {exec.error && (
              <p className='text-xs text-destructive'>{exec.error}</p>
            )}
          </div>
          <div className='flex shrink-0 flex-col items-end gap-1'>
            {expanded ? (
              <ChevronUp className='size-4 text-muted-foreground' />
            ) : (
              <ChevronDown className='size-4 text-muted-foreground' />
            )}
            <span className='text-[10px] text-muted-foreground'>
              {formatDuration(exec.startedAt, exec.completedAt)}
            </span>
          </div>
        </button>

        {expanded && (
          <div className='mt-3 border-t pt-3'>
            {logsLoading ? (
              <div className='space-y-2'>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className='h-4 w-full' />
                ))}
              </div>
            ) : logs.length > 0 ? (
              <div className='max-h-48 space-y-1.5 overflow-y-auto'>
                {logs.map((log) => (
                  <div key={log.id} className='flex items-start gap-2 text-xs'>
                    <Badge
                      variant='outline'
                      className={cn('mt-0.5 shrink-0 text-[9px]', LOG_LEVEL_STYLES[log.level] ?? '')}
                    >
                      {log.level}
                    </Badge>
                    <span className='min-w-0 flex-1 text-muted-foreground'>{log.message}</span>
                    <span className='shrink-0 text-[10px] text-muted-foreground/60'>
                      {formatDateTime(log.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-xs text-muted-foreground'>No logs available for this execution.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page
// ============================================

export default function ExecutionHistoryPage() {
  // Data state
  const [executions, setExecutions] = useState<Execution[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Expanded execution (desktop)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedLogs, setExpandedLogs] = useState<ExecutionLog[]>([])
  const [expandedLoading, setExpandedLoading] = useState(false)

  // Fetch executions
  const fetchExecutions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      })

      if (statusFilter !== 'ALL') params.set('status', statusFilter)

      const data = await apiFetch<PaginatedResponse>(`/api/v1/automation/executions?${params}`)
      setExecutions(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load executions'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    fetchExecutions()
  }, [fetchExecutions])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
    setExpandedId(null)
  }, [statusFilter])

  // Desktop: expand execution to show logs
  const handleExpandDesktop = async (execId: string) => {
    if (expandedId === execId) {
      setExpandedId(null)
      setExpandedLogs([])
      return
    }
    setExpandedId(execId)
    setExpandedLoading(true)
    try {
      const res = await apiFetch<{ success: boolean; data: { logs: ExecutionLog[] } }>(
        `/api/v1/automation/executions/${execId}`
      )
      setExpandedLogs(res.data.logs ?? [])
    } catch {
      toast.error('Failed to load execution logs')
      setExpandedLogs([])
    } finally {
      setExpandedLoading(false)
    }
  }

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

  const hasActiveFilters = statusFilter !== 'ALL'

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Execution History</h1>
          <p className='text-muted-foreground mt-1'>
            View all automation execution records
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className='flex flex-wrap items-center gap-2'>
        <div className='flex items-center gap-1.5 text-sm text-muted-foreground'>
          <Filter className='size-4' />
          <span className='hidden sm:inline'>Filter:</span>
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className='w-[150px]' aria-label='Filter by status'>
            <SelectValue placeholder='All Statuses' />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant='ghost' size='sm' onClick={() => setStatusFilter('ALL')}>
            <RotateCcw className='size-3' />
            Clear
          </Button>
        )}
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
              onClick={fetchExecutions}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && executions.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Activity className='mb-3 size-10 text-muted-foreground/50' />
            <p className='text-sm font-medium text-muted-foreground'>No executions found</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              {hasActiveFilters
                ? 'Try adjusting your filters.'
                : 'Executions will appear here when workflows run.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Desktop Table */}
      {!loading && !error && executions.length > 0 && (
        <>
          <Card className='hidden md:block'>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='min-w-[180px]'>Workflow</TableHead>
                    <TableHead>Trigger Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className='w-[40px]' />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.map((exec) => (
                    <>
                      <TableRow
                        key={exec.id}
                        className='cursor-pointer'
                        onClick={() => handleExpandDesktop(exec.id)}
                      >
                        <TableCell className='font-medium'>{exec.workflow.name}</TableCell>
                        <TableCell className='text-muted-foreground'>
                          {TRIGGER_EVENT_LABELS[exec.triggerEvent] ?? exec.triggerEvent}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant='outline'
                            className={cn('text-[10px]', EXECUTION_STATUS_STYLES[exec.status] ?? '')}
                          >
                            {exec.status}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-xs text-muted-foreground'>
                          {exec.entityType ? (
                            <span>{exec.entityType}{exec.entityId ? `: ${exec.entityId.slice(0, 8)}…` : ''}</span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className='whitespace-nowrap text-xs text-muted-foreground'>
                          {formatDateTime(exec.startedAt)}
                        </TableCell>
                        <TableCell className='text-xs text-muted-foreground'>
                          {formatDuration(exec.startedAt, exec.completedAt)}
                        </TableCell>
                        <TableCell>
                          {expandedId === exec.id ? (
                            <ChevronUp className='size-4 text-muted-foreground' />
                          ) : (
                            <ChevronDown className='size-4 text-muted-foreground' />
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expanded Logs Row */}
                      {expandedId === exec.id && (
                        <TableRow key={`${exec.id}-logs`}>
                          <TableCell colSpan={7} className='bg-muted/30 px-6 py-4'>
                            {expandedLoading ? (
                              <div className='space-y-2'>
                                {Array.from({ length: 3 }).map((_, i) => (
                                  <Skeleton key={i} className='h-4 w-full' />
                                ))}
                              </div>
                            ) : expandedLogs.length > 0 ? (
                              <div className='max-h-64 space-y-1.5 overflow-y-auto'>
                                <p className='mb-2 text-xs font-medium text-muted-foreground'>
                                  Execution Logs ({expandedLogs.length})
                                </p>
                                {expandedLogs.map((log) => (
                                  <div key={log.id} className='flex items-start gap-2 text-xs'>
                                    <Badge
                                      variant='outline'
                                      className={cn('mt-0.5 shrink-0 text-[9px]', LOG_LEVEL_STYLES[log.level] ?? '')}
                                    >
                                      {log.level}
                                    </Badge>
                                    <span className='min-w-0 flex-1 text-muted-foreground'>{log.message}</span>
                                    <span className='shrink-0 text-[10px] text-muted-foreground/60'>
                                      {formatDateTime(log.createdAt)}
                                    </span>
                                  </div>
                                ))}
                                {exec.error && (
                                  <div className='mt-2 rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-900/50 dark:bg-red-900/20'>
                                    <p className='text-xs font-medium text-red-600 dark:text-red-400'>Error</p>
                                    <p className='mt-0.5 text-xs text-red-600/80 dark:text-red-400/80'>{exec.error}</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className='text-xs text-muted-foreground'>No logs available for this execution.</p>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Cards */}
          <div className='flex flex-col gap-3 md:hidden'>
            {executions.map((exec) => (
              <MobileExecutionCard
                key={exec.id}
                exec={exec}
                expanded={expandedId === exec.id}
                onToggle={() => handleExpandDesktop(exec.id)}
                logs={expandedId === exec.id ? expandedLogs : []}
                logsLoading={expandedId === exec.id && expandedLoading}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>
                Showing {executions.length} of {total} executions
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
