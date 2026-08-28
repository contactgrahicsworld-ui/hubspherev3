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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Plus,
  Search,
  Filter,
  AlertCircle,
  Zap,
  RotateCcw,
  Loader2,
  Play,
  Pause,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================
// Types
// ============================================

interface Workflow {
  id: string
  name: string
  description: string | null
  status: string
  triggerType: string
  executionCount: number
  lastExecutedAt: string | null
  createdAt: string
  updatedAt: string
  creator: { id: string; name: string | null; email: string | null } | null
  _count: { triggers: number; conditions: number; actions: number; executions: number }
}

interface PaginatedResponse {
  success: boolean
  data: Workflow[]
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

const TRIGGER_OPTIONS = Object.entries(TRIGGER_EVENT_LABELS).map(([value, label]) => ({ value, label }))

const WORKFLOW_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-secondary text-secondary-foreground',
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PAUSED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ARCHIVED: 'bg-muted text-muted-foreground',
}

const STATUS_FILTER_OPTIONS = ['ALL', 'DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']

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
              {Array.from({ length: 6 }).map((_, i) => (
                <TableHead key={i}><Skeleton className='h-4 w-20' /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
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

function MobileWorkflowCard({ wf, onClick, onToggle }: { wf: Workflow; onClick: () => void; onToggle: () => void }) {
  return (
    <Card className='transition-shadow hover:shadow-md'>
      <CardContent className='p-4'>
        <div className='flex items-start justify-between gap-2'>
          <div
            className='min-w-0 flex-1 cursor-pointer'
            onClick={onClick}
            role='button'
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
          >
            <p className='truncate font-medium'>{wf.name}</p>
            {wf.description && (
              <p className='mt-0.5 line-clamp-1 text-xs text-muted-foreground'>{wf.description}</p>
            )}
          </div>
          <Badge variant='outline' className={cn('shrink-0 text-[10px]', WORKFLOW_STATUS_STYLES[wf.status] ?? '')}>
            {wf.status}
          </Badge>
        </div>

        <div className='mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
          <Badge variant='outline' className='text-[10px]'>
            {TRIGGER_EVENT_LABELS[wf.triggerType] ?? wf.triggerType}
          </Badge>
          <span>{wf._count.executions} runs</span>
          <span>{formatDate(wf.createdAt)}</span>
        </div>

        <div className='mt-3 flex items-center justify-end gap-2'>
          {(wf.status === 'DRAFT' || wf.status === 'PAUSED') && (
            <Button variant='outline' size='sm' className='h-8 text-xs' onClick={(e) => { e.stopPropagation(); onToggle() }}>
              <Play className='size-3' />
              Activate
            </Button>
          )}
          {wf.status === 'ACTIVE' && (
            <Button variant='outline' size='sm' className='h-8 text-xs' onClick={(e) => { e.stopPropagation(); onToggle() }}>
              <Pause className='size-3' />
              Pause
            </Button>
          )}
          <Button variant='ghost' size='sm' className='h-8 text-xs' onClick={onClick}>
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Create Workflow Dialog
// ============================================

function CreateWorkflowDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = name.trim() && triggerType

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || submitting) return

    try {
      setSubmitting(true)
      const res = await apiFetch<{ success: boolean; data: { id: string }; message?: string }>(
        '/api/v1/automation/workflows',
        {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            status: 'DRAFT',
            triggerType,
            triggers: [{ eventType: triggerType, config: {} }],
            actions: [{ type: 'create_notification', config: {}, sortOrder: 0, delayMs: 0 }],
          }),
        }
      )
      toast.success(res.message || 'Workflow created successfully')
      setName('')
      setDescription('')
      setTriggerType('')
      onOpenChange(false)
      onSuccess(res.data.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create workflow'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Create Workflow</DialogTitle>
          <DialogDescription>
            Set up a new automation workflow. You can add triggers, conditions, and actions after creation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='wf-name'>Name</Label>
            <Input
              id='wf-name'
              placeholder='e.g., Auto-assign new leads'
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              autoFocus
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='wf-desc'>Description</Label>
            <Textarea
              id='wf-desc'
              placeholder='What does this workflow do?'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={3}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='wf-trigger'>Trigger Type</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger id='wf-trigger'>
                <SelectValue placeholder='Select a trigger event' />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type='submit' disabled={!canSubmit || submitting}>
              {submitting && <Loader2 className='size-4 animate-spin' />}
              Create Workflow
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Main Page
// ============================================

export default function WorkflowsListPage() {
  const router = useRouter()

  // Data state
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [triggerTypeFilter, setTriggerTypeFilter] = useState('')

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  // Fetch workflows
  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      })

      if (debouncedSearch) params.set('search', debouncedSearch)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (triggerTypeFilter) params.set('triggerType', triggerTypeFilter)

      const data = await apiFetch<PaginatedResponse>(`/api/v1/automation/workflows?${params}`)
      setWorkflows(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load workflows'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, statusFilter, triggerTypeFilter])

  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, triggerTypeFilter])

  // Toggle workflow status (activate/pause)
  const handleToggle = async (wf: Workflow) => {
    const action = wf.status === 'ACTIVE' ? 'pause' : 'activate'
    setTogglingId(wf.id)
    try {
      await apiFetch(`/api/v1/automation/workflows/${wf.id}/${action}`, { method: 'POST' })
      toast.success(`Workflow ${action}d successfully`)
      fetchWorkflows()
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to ${action} workflow`
      toast.error(msg)
    } finally {
      setTogglingId(null)
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

  const hasActiveFilters = search || statusFilter !== 'ALL' || triggerTypeFilter

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('ALL')
    setTriggerTypeFilter('')
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Workflows</h1>
          <p className='text-muted-foreground mt-1'>
            Manage and configure automation workflows
          </p>
        </div>
        <Button className='min-w-[150px]' onClick={() => setCreateOpen(true)}>
          <Plus className='size-4' />
          Create Workflow
        </Button>
      </div>

      {/* Search and Filters */}
      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Search workflows...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-9'
            aria-label='Search workflows'
          />
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <div className='flex items-center gap-1.5 text-sm text-muted-foreground'>
            <Filter className='size-4' />
            <span className='hidden sm:inline'>Filters:</span>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-[130px]' aria-label='Filter by status'>
              <SelectValue placeholder='All Statuses' />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={triggerTypeFilter} onValueChange={(v) => setTriggerTypeFilter(v === '_all' ? '' : v)}>
            <SelectTrigger className='w-[160px]' aria-label='Filter by trigger type'>
              <SelectValue placeholder='All Triggers' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='_all'>All Triggers</SelectItem>
              {TRIGGER_OPTIONS.map((opt) => (
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
              onClick={fetchWorkflows}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && workflows.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Zap className='mb-3 size-10 text-muted-foreground/50' />
            <p className='text-sm font-medium text-muted-foreground'>No workflows yet</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              {hasActiveFilters
                ? 'Try adjusting your filters.'
                : 'Create your first automation.'}
            </p>
            {!hasActiveFilters && (
              <Button className='mt-4' size='sm' onClick={() => setCreateOpen(true)}>
                <Plus className='size-4' />
                Create Workflow
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Desktop Table */}
      {!loading && !error && workflows.length > 0 && (
        <>
          <Card className='hidden md:block'>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='min-w-[200px]'>Name</TableHead>
                    <TableHead>Trigger Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className='text-right'>Executions</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className='w-[120px]'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflows.map((wf) => (
                    <TableRow
                      key={wf.id}
                      className='cursor-pointer'
                      onClick={() => router.push(`/automation/workflows/${wf.id}`)}
                    >
                      <TableCell>
                        <div>
                          <p className='font-medium'>{wf.name}</p>
                          {wf.description && (
                            <p className='mt-0.5 max-w-[300px] truncate text-xs text-muted-foreground'>
                              {wf.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        <Badge variant='outline' className='text-[10px]'>
                          {TRIGGER_EVENT_LABELS[wf.triggerType] ?? wf.triggerType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline' className={cn('text-[10px]', WORKFLOW_STATUS_STYLES[wf.status] ?? '')}>
                          {wf.status}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-right font-medium'>
                        {wf._count.executions}
                      </TableCell>
                      <TableCell className='whitespace-nowrap text-xs text-muted-foreground'>
                        {formatDate(wf.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center gap-1'>
                          {(wf.status === 'DRAFT' || wf.status === 'PAUSED') && (
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-7 px-2 text-xs'
                              disabled={togglingId === wf.id}
                              onClick={(e) => { e.stopPropagation(); handleToggle(wf) }}
                            >
                              {togglingId === wf.id ? (
                                <Loader2 className='size-3 animate-spin' />
                              ) : (
                                <Play className='size-3' />
                              )}
                            </Button>
                          )}
                          {wf.status === 'ACTIVE' && (
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-7 px-2 text-xs'
                              disabled={togglingId === wf.id}
                              onClick={(e) => { e.stopPropagation(); handleToggle(wf) }}
                            >
                              {togglingId === wf.id ? (
                                <Loader2 className='size-3 animate-spin' />
                              ) : (
                                <Pause className='size-3' />
                              )}
                            </Button>
                          )}
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-7 px-2 text-xs'
                            onClick={(e) => { e.stopPropagation(); router.push(`/automation/workflows/${wf.id}`) }}
                          >
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Cards */}
          <div className='flex flex-col gap-3 md:hidden'>
            {workflows.map((wf) => (
              <MobileWorkflowCard
                key={wf.id}
                wf={wf}
                onClick={() => router.push(`/automation/workflows/${wf.id}`)}
                onToggle={() => handleToggle(wf)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>
                Showing {workflows.length} of {total} workflows
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

      {/* Create Workflow Dialog */}
      <CreateWorkflowDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={(id) => router.push(`/automation/workflows/${id}`)}
      />
    </div>
  )
}
