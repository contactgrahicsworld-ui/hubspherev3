'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Zap,
  PlayCircle,
  Activity,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MetricCardSkeleton } from '@/components/skeletons'

// ============================================
// Types
// ============================================

interface DashboardData {
  workflows: {
    total: number
    byStatus: Record<string, number>
  }
  executions: {
    total: number
    byStatus: Record<string, number>
    successRate: number
    failureRate: number
    recent24h: number
    recent24hFailed: number
  }
  triggers: {
    distribution: Array<{ eventType: string; count: number }>
  }
}

interface WorkflowSummary {
  id: string
  name: string
  description: string | null
  status: string
  triggerType: string
  executionCount: number
  lastExecutedAt: string | null
  createdAt: string
  _count: { triggers: number; conditions: number; actions: number; executions: number }
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

const WORKFLOW_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-secondary text-secondary-foreground',
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PAUSED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ARCHIVED: 'bg-muted text-muted-foreground',
}

const EXECUTION_STATUS_STYLES: Record<string, string> = {
  RUNNING: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-muted text-muted-foreground',
}

// ============================================
// Helpers
// ============================================

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return '—'
  }
}


function MetricCardDisplay({
  card,
}: {
  card: {
    label: string
    value: number | string
    icon: React.ReactNode
    variant?: 'default' | 'warning' | 'danger' | 'success'
  }
}) {
  const variantClasses: Record<string, string> = {
    default: 'bg-primary/10 text-primary',
    warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    danger: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  }

  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-center gap-3'>
          <div
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg',
              variantClasses[card.variant ?? 'default']
            )}
          >
            {card.icon}
          </div>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-xs text-muted-foreground'>{card.label}</p>
            <p className='text-xl font-semibold leading-tight'>
              {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TableSkeleton() {
  return (
    <Card>
      <CardContent className='p-0'>
        <div className='divide-y'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className='flex items-center gap-4 px-4 py-3'>
              <Skeleton className='h-4 w-[180px]' />
              <Skeleton className='h-5 w-24 rounded-full' />
              <Skeleton className='ml-auto h-4 w-16' />
              <Skeleton className='h-4 w-20' />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page
// ============================================

export default function AutomationDashboardPage() {
  const router = useRouter()
  const [dashData, setDashData] = useState<DashboardData | null>(null)
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dbUnavailable, setDbUnavailable] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setDbUnavailable(false)

      const [dashRes, wfRes] = await Promise.all([
        apiFetch<{ success: boolean; data: DashboardData }>('/api/v1/automation/dashboard'),
        apiFetch<{ success: boolean; data: WorkflowSummary[]; pagination: { total: number; totalPages: number } }>(
          '/api/v1/automation/workflows?limit=10'
        ),
      ])

      setDashData(dashRes.data)
      setWorkflows(wfRes.data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard'
      if (msg.includes('Database unavailable') || msg.includes('503')) {
        setDbUnavailable(true)
        setError('Service Temporarily Unavailable')
      } else {
        setError(msg)
      }
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ---- Loading State ----
  if (loading) {
    return (
      <div className='space-y-6'>
        <div>
          <Skeleton className='h-8 w-48' />
          <Skeleton className='mt-1 h-4 w-72' />
        </div>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          <TableSkeleton />
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='h-5 w-36' />
            </CardHeader>
            <CardContent>
              <div className='space-y-3'>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className='flex items-center gap-3'>
                    <Skeleton className='h-4 w-32' />
                    <Skeleton className='h-2 flex-1' />
                    <Skeleton className='h-4 w-8' />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ---- Error / DB Unavailable State ----
  if (error || !dashData) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Automation</h1>
          <p className='text-muted-foreground mt-1'>Workflow automation dashboard</p>
        </div>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertTriangle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>
              {dbUnavailable ? 'Service Temporarily Unavailable' : error || 'Failed to load dashboard data'}
            </p>
            {dbUnavailable && (
              <p className='text-xs text-muted-foreground'>
                The database is not responding. This is usually a temporary issue.
              </p>
            )}
            <button
              onClick={fetchData}
              className='mt-2 text-sm text-primary underline-offset-4 hover:underline'
            >
              Try again
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Build Data ----
  const activeWorkflows = dashData.workflows.byStatus['ACTIVE'] ?? 0
  const successRate = dashData.executions.successRate

  const metricCards = [
    {
      label: 'Total Workflows',
      value: dashData.workflows.total,
      icon: <Zap className='size-4' />,
      variant: 'default' as const,
    },
    {
      label: 'Active Workflows',
      value: activeWorkflows,
      icon: <PlayCircle className='size-4' />,
      variant: 'success' as const,
    },
    {
      label: 'Executions (24h)',
      value: dashData.executions.recent24h,
      icon: <Activity className='size-4' />,
      variant: dashData.executions.recent24hFailed > 0 ? ('warning' as const) : ('default' as const),
    },
    {
      label: 'Success Rate',
      value: `${successRate}%`,
      icon: <TrendingUp className='size-4' />,
      variant: successRate >= 80 ? ('success' as const) : successRate >= 50 ? ('warning' as const) : ('danger' as const),
    },
  ]

  // Trigger distribution
  const triggerDist = dashData.triggers.distribution
  const maxTriggerCount = triggerDist.length > 0 ? Math.max(...triggerDist.map((t) => t.count)) : 1

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Automation</h1>
          <p className='text-muted-foreground mt-1'>
            Workflow automation dashboard
          </p>
        </div>
        <Button onClick={() => router.push('/automation/workflows')}>
          View All Workflows
          <ArrowRight className='size-4' />
        </Button>
      </div>

      {/* Metric Cards */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {metricCards.map((card) => (
          <MetricCardDisplay key={card.label} card={card} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Recent Workflows */}
        <Card>
          <CardHeader className='pb-2'>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-base'>Recent Workflows</CardTitle>
              <Button
                variant='ghost'
                size='sm'
                className='text-xs'
                onClick={() => router.push('/automation/workflows')}
              >
                View all
                <ArrowRight className='ml-1 size-3' />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {workflows.length > 0 ? (
              <div className='max-h-96 overflow-y-auto'>
                <div className='divide-y'>
                  {workflows.map((wf) => (
                    <div
                      key={wf.id}
                      className='flex cursor-pointer items-center gap-3 py-3 first:pt-0 last:pb-0'
                      onClick={() => router.push(`/automation/workflows/${wf.id}`)}
                      role='button'
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/automation/workflows/${wf.id}`) }}
                    >
                      <div className='min-w-0 flex-1'>
                        <p className='truncate text-sm font-medium'>{wf.name}</p>
                        <p className='mt-0.5 truncate text-xs text-muted-foreground'>
                          {TRIGGER_EVENT_LABELS[wf.triggerType] ?? wf.triggerType}
                        </p>
                      </div>
                      <Badge variant='outline' className={cn('shrink-0 text-[10px]', WORKFLOW_STATUS_STYLES[wf.status] ?? '')}>
                        {wf.status}
                      </Badge>
                      <div className='hidden shrink-0 text-right sm:block'>
                        <p className='text-xs font-medium'>{wf._count.executions}</p>
                        <p className='text-[10px] text-muted-foreground'>runs</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className='flex flex-col items-center justify-center py-8 text-center'>
                <Zap className='mb-2 size-8 text-muted-foreground/40' />
                <p className='text-sm text-muted-foreground'>No workflows yet</p>
                <Button
                  variant='outline'
                  size='sm'
                  className='mt-3'
                  onClick={() => router.push('/automation/workflows')}
                >
                  Create Workflow
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trigger Type Distribution */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Trigger Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {triggerDist.length > 0 ? (
              <div className='space-y-3'>
                {triggerDist
                  .sort((a, b) => b.count - a.count)
                  .map((item) => {
                    const pct = maxTriggerCount > 0 ? (item.count / maxTriggerCount) * 100 : 0
                    return (
                      <div key={item.eventType} className='space-y-1'>
                        <div className='flex items-center justify-between text-sm'>
                          <span className='truncate text-muted-foreground'>
                            {TRIGGER_EVENT_LABELS[item.eventType] ?? item.eventType}
                          </span>
                          <span className='shrink-0 font-medium'>{item.count}</span>
                        </div>
                        <div className='h-2 w-full overflow-hidden rounded-full bg-secondary'>
                          <div
                            className='h-full rounded-full bg-primary transition-all'
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            ) : (
              <div className='flex h-48 items-center justify-center text-sm text-muted-foreground'>
                No trigger data available yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Execution Stats Summary */}
      <Card>
        <CardHeader className='pb-2'>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-base'>Execution Summary</CardTitle>
            <Button
              variant='ghost'
              size='sm'
              className='text-xs'
              onClick={() => router.push('/automation/executions')}
            >
              View all
              <ArrowRight className='ml-1 size-3' />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {dashData.executions.total > 0 ? (
            <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
              <div className='flex items-center gap-2 rounded-lg border p-3'>
                <Activity className='size-4 text-muted-foreground' />
                <div>
                  <p className='text-lg font-semibold'>{dashData.executions.total}</p>
                  <p className='text-[10px] text-muted-foreground'>Total Executions</p>
                </div>
              </div>
              <div className='flex items-center gap-2 rounded-lg border p-3'>
                <CheckCircle className='size-4 text-emerald-500' />
                <div>
                  <p className='text-lg font-semibold'>{dashData.executions.byStatus['COMPLETED'] ?? 0}</p>
                  <p className='text-[10px] text-muted-foreground'>Completed</p>
                </div>
              </div>
              <div className='flex items-center gap-2 rounded-lg border p-3'>
                <XCircle className='size-4 text-red-500' />
                <div>
                  <p className='text-lg font-semibold'>{dashData.executions.byStatus['FAILED'] ?? 0}</p>
                  <p className='text-[10px] text-muted-foreground'>Failed</p>
                </div>
              </div>
              <div className='flex items-center gap-2 rounded-lg border p-3'>
                <Loader2 className='size-4 text-sky-500' />
                <div>
                  <p className='text-lg font-semibold'>{dashData.executions.byStatus['RUNNING'] ?? 0}</p>
                  <p className='text-[10px] text-muted-foreground'>Running</p>
                </div>
              </div>
            </div>
          ) : (
            <div className='flex flex-col items-center justify-center py-8 text-center'>
              <Clock className='mb-2 size-8 text-muted-foreground/40' />
              <p className='text-sm text-muted-foreground'>No executions yet</p>
              <p className='mt-1 text-xs text-muted-foreground'>
                Executions will appear here when workflows run.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
