'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { TaskFormDialog } from '@/components/crm/task-form'
import { PRIORITIES } from '@/lib/constants'
import {
  Plus,
  Search,
  AlertCircle,
  CheckSquare,
  CalendarClock,
  User,
  RotateCcw,
  Filter,
  Link2,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface TaskOwner {
  id: string
  name: string | null
  email: string | null
}

interface Task {
  id: string
  title: string
  description: string | null
  status: string | null
  priority: string | null
  dueDate: string | null
  entityType: string | null
  entityId: string | null
  ownerId: string | null
  owner: TaskOwner | null
  createdAt: string
  updatedAt: string
}

interface PaginatedResponse {
  success: boolean
  data: Task[]
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
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const STATUS_BADGE_STYLES: Record<string, string> = {
  TODO: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const PRIORITY_BADGE_STYLES: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  MEDIUM: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const ENTITY_ROUTE_MAP: Record<string, string> = {
  LEAD: '/crm/leads/',
  CONTACT: '/crm/contacts/',
  COMPANY: '/crm/companies/',
  DEAL: '/crm/deals/',
}

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

function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false
  const due = new Date(task.dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return due < today
}

function statusBadge(status: string | null) {
  const s = status ?? 'TODO'
  return (
    <Badge variant='outline' className={STATUS_BADGE_STYLES[s] || ''}>
      {STATUS_LABELS[s] || s}
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
// Card Skeleton
// ============================================

function CardSkeleton() {
  return (
    <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
      {Array.from({ length: 6 }).map((_, i) => (
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
              <Skeleton className='h-6 w-16' />
              <Skeleton className='h-6 w-24' />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================
// Task Card
// ============================================

function TaskCard({ task }: { task: Task }) {
  const overdue = isOverdue(task)

  return (
    <Card
      className={`transition-shadow hover:shadow-md ${overdue ? 'border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20' : ''}`}
    >
      <CardContent className='p-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0 flex-1'>
            <p className={`truncate font-medium ${task.status === 'COMPLETED' ? 'line-through text-muted-foreground' : ''}`}>
              {task.title}
            </p>
            {task.description && (
              <p className='mt-1 line-clamp-2 text-sm text-muted-foreground'>
                {task.description}
              </p>
            )}
          </div>
          {statusBadge(task.status)}
        </div>

        <div className='mt-3 flex flex-wrap items-center gap-2'>
          {priorityBadge(task.priority)}
          {task.dueDate && (
            <span className={`flex items-center gap-1 text-xs ${overdue ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
              <CalendarClock className='size-3 shrink-0' />
              {formatDate(task.dueDate)}
              {overdue && ' (Overdue)'}
            </span>
          )}
        </div>

        <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
          {task.owner && (
            <span className='flex items-center gap-1'>
              <User className='size-3 shrink-0' />
              {task.owner.name || task.owner.email}
            </span>
          )}
          {task.entityType && task.entityId && (
            <span className='flex items-center gap-1'>
              <Link2 className='size-3 shrink-0' />
              <a
                href={`${ENTITY_ROUTE_MAP[task.entityType] || ''}${task.entityId}`}
                className='text-primary underline-offset-2 hover:underline'
                onClick={(e) => e.stopPropagation()}
              >
                {task.entityType}
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

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [statusTab, setStatusTab] = useState('')
  const [priority, setPriority] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [dueDateFrom, setDueDateFrom] = useState('')
  const [dueDateTo, setDueDateTo] = useState('')
  const [search, setSearch] = useState('')

  // Form dialog
  const [formOpen, setFormOpen] = useState(false)

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      })

      if (statusTab) params.set('status', statusTab)
      if (priority) params.set('priority', priority)
      if (ownerId) params.set('ownerId', ownerId)
      if (dueDateFrom) params.set('dueDateFrom', dueDateFrom)
      if (dueDateTo) params.set('dueDateTo', dueDateTo)
      if (search) params.set('search', search)

      const data = await apiFetch<PaginatedResponse>(`/api/v1/crm/tasks?${params}`)
      setTasks(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load tasks'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [page, statusTab, priority, ownerId, dueDateFrom, dueDateTo, search])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [statusTab, priority, ownerId, dueDateFrom, dueDateTo, search])

  const hasActiveFilters = priority || ownerId || dueDateFrom || dueDateTo || search

  const clearFilters = () => {
    setPriority('')
    setOwnerId('')
    setDueDateFrom('')
    setDueDateTo('')
    setSearch('')
  }

  const overdueCount = useMemo(
    () => tasks.filter((t) => isOverdue(t)).length,
    [tasks]
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
          <h1 className='text-2xl font-bold tracking-tight'>Tasks</h1>
          <p className='mt-1 text-muted-foreground'>
            Manage and track your tasks and to-dos
          </p>
        </div>
        <Button className='min-w-[130px]' onClick={() => setFormOpen(true)}>
          <Plus className='size-4' />
          Create Task
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
            placeholder='Search tasks...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-9'
            aria-label='Search tasks'
          />
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <div className='flex items-center gap-1.5 text-sm text-muted-foreground'>
            <Filter className='size-4' />
            <span className='hidden sm:inline'>Filters:</span>
          </div>

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

          <Input
            type='date'
            value={dueDateFrom}
            onChange={(e) => setDueDateFrom(e.target.value)}
            className='w-[150px]'
            placeholder='Due from'
            aria-label='Due date from'
          />

          <Input
            type='date'
            value={dueDateTo}
            onChange={(e) => setDueDateTo(e.target.value)}
            className='w-[150px]'
            placeholder='Due to'
            aria-label='Due date to'
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
        <div className='flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400'>
          <AlertCircle className='size-4 shrink-0' />
          <span>
            {overdueCount} overdue {overdueCount === 1 ? 'task' : 'tasks'} need attention
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
              onClick={fetchTasks}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && tasks.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <CheckSquare className='mb-3 size-10 text-muted-foreground/50' />
            <p className='text-sm font-medium text-muted-foreground'>No tasks found</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              {statusTab || hasActiveFilters
                ? 'Try adjusting your filters.'
                : 'Create your first task to get started.'}
            </p>
            {!statusTab && !hasActiveFilters && (
              <Button className='mt-4' size='sm' onClick={() => setFormOpen(true)}>
                <Plus className='size-4' />
                Create Task
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Task Cards */}
      {!loading && !error && tasks.length > 0 && (
        <>
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>
                Showing {tasks.length} of {total} tasks
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

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={fetchTasks}
      />
    </div>
  )
}
