'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Zap,
  AlertTriangle,
  RefreshCw,
  PlayCircle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  ArrowUpRight,
} from 'lucide-react'
import { MetricCardSkeleton } from '@/components/skeletons'

// ============================================
// Types
// ============================================

interface AutomationAnalyticsData {
  activeWorkflows: number
  totalWorkflows: number
  executionStats: {
    total: number
    completed: number
    failed: number
    running: number
    successRate: number
  }
  topTriggers: Array<{
    eventType: string
    count: number
  }>
  topActions: Array<{
    actionType: string
    count: number
  }>
}

// ============================================
// Helpers
// ============================================

const TRIGGER_LABELS: Record<string, string> = {
  'lead.created': 'Lead Created',
  'lead.updated': 'Lead Updated',
  'deal.created': 'Deal Created',
  'deal.won': 'Deal Won',
  'deal.lost': 'Deal Lost',
  'task.completed': 'Task Completed',
  'followup.due': 'Follow-up Due',
  'call.completed': 'Call Completed',
  'attendance.checkin': 'Attendance Check-in',
}


function KPICard({
  label,
  value,
  icon,
  variant = 'default',
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  variant?: 'default' | 'success' | 'danger' | 'warning'
}) {
  const variantClasses: Record<string, string> = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    danger: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  }

  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-center gap-3'>
          <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${variantClasses[variant]}`}>
            {icon}
          </div>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-xs text-muted-foreground'>{label}</p>
            <p className='text-xl font-semibold leading-tight'>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page
// ============================================

export default function AutomationAnalyticsPage() {
  const [data, setData] = useState<AutomationAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch<{ success: boolean; data: AutomationAnalyticsData }>(
        '/api/v1/analytics/automation'
      )
      setData(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load automation analytics'
      setError(message)
      toast.error(message)
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
          <Skeleton className='h-8 w-52' />
          <Skeleton className='mt-1 h-4 w-72' />
        </div>
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
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
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='h-5 w-32' />
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

  // ---- Error State ----
  if (error || !data) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Automation Analytics</h1>
          <p className='text-muted-foreground mt-1'>Workflow execution and trigger insights</p>
        </div>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertTriangle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>{error || 'Failed to load automation data'}</p>
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

  const es = data.executionStats
  const triggers = data.topTriggers ?? []
  const actions = data.topActions ?? []
  const maxTriggerCount = Math.max(...triggers.map((t) => t.count), 1)
  const maxActionCount = Math.max(...actions.map((a) => a.count), 1)

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Automation Analytics</h1>
          <p className='text-muted-foreground mt-1'>Workflow execution and trigger insights</p>
        </div>
        <Button variant='outline' size='sm' onClick={fetchData}>
          <RefreshCw className='size-4' />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
        <KPICard
          label='Active Workflows'
          value={data.activeWorkflows.toLocaleString()}
          icon={<PlayCircle className='size-4' />}
          variant='success'
        />
        <KPICard
          label='Total Workflows'
          value={data.totalWorkflows.toLocaleString()}
          icon={<Zap className='size-4' />}
        />
        <KPICard
          label='Total Executions'
          value={es.total.toLocaleString()}
          icon={<Activity className='size-4' />}
        />
        <KPICard
          label='Success Rate'
          value={`${es.successRate}%`}
          icon={<ArrowUpRight className='size-4' />}
          variant={es.successRate >= 80 ? 'success' : es.successRate >= 50 ? 'warning' : 'danger'}
        />
      </div>

      {/* Execution Stats */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Execution Stats</CardTitle>
        </CardHeader>
        <CardContent>
          {es.total > 0 ? (
            <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
              <div className='flex items-center gap-2 rounded-lg border p-3'>
                <Activity className='size-4 text-muted-foreground' />
                <div>
                  <p className='text-lg font-semibold'>{es.total}</p>
                  <p className='text-[10px] text-muted-foreground'>Total</p>
                </div>
              </div>
              <div className='flex items-center gap-2 rounded-lg border p-3'>
                <CheckCircle className='size-4 text-emerald-500' />
                <div>
                  <p className='text-lg font-semibold'>{es.completed}</p>
                  <p className='text-[10px] text-muted-foreground'>Completed</p>
                </div>
              </div>
              <div className='flex items-center gap-2 rounded-lg border p-3'>
                <XCircle className='size-4 text-red-500' />
                <div>
                  <p className='text-lg font-semibold'>{es.failed}</p>
                  <p className='text-[10px] text-muted-foreground'>Failed</p>
                </div>
              </div>
              <div className='flex items-center gap-2 rounded-lg border p-3'>
                <Clock className='size-4 text-sky-500' />
                <div>
                  <p className='text-lg font-semibold'>{es.running}</p>
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

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Top Triggers */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Top Triggers</CardTitle>
          </CardHeader>
          <CardContent>
            {triggers.length > 0 ? (
              <div className='space-y-3'>
                {triggers.map((trigger) => {
                  const pct = (trigger.count / maxTriggerCount) * 100
                  return (
                    <div key={trigger.eventType} className='space-y-1'>
                      <div className='flex items-center justify-between text-sm'>
                        <span className='truncate text-muted-foreground'>
                          {TRIGGER_LABELS[trigger.eventType] ?? trigger.eventType}
                        </span>
                        <span className='shrink-0 font-medium'>{trigger.count}</span>
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

        {/* Top Actions */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Top Actions</CardTitle>
          </CardHeader>
          <CardContent>
            {actions.length > 0 ? (
              <div className='space-y-3'>
                {actions.map((action) => {
                  const pct = (action.count / maxActionCount) * 100
                  return (
                    <div key={action.actionType} className='space-y-1'>
                      <div className='flex items-center justify-between text-sm'>
                        <span className='truncate text-muted-foreground'>{action.actionType}</span>
                        <span className='shrink-0 font-medium'>{action.count}</span>
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
                No action data available yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
