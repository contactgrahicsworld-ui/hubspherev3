'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  UserPlus,
  UserCheck,
  Handshake,
  DollarSign,
  Trophy,
  Clock,
  AlertTriangle,
  Phone,
  Activity,
  ArrowUpRight,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { MetricCardSkeleton, ChartSkeleton } from '@/components/skeletons'

const DealsStageChart = dynamic(
  () => import('@/components/deals-stage-chart'),
  {
    ssr: false,
    loading: () => <div className='flex h-[260px] items-center justify-center animate-pulse rounded-lg bg-muted' />,
  }
)

// ============================================
// Types
// ============================================

interface DashboardData {
  leads: {
    total: number
    new: number
    qualified: number
    won: number
    lost: number
  }
  deals: {
    open: number
    pipelineValue: number
    wonDealsValue: number
    lostDealsValue: number
  }
  followUps: {
    today: number
    overdue: number
  }
  calls: {
    today: number
  }
  tasksByStatus: Record<string, number>
  dealsByStage: Array<{ stage: string; count: number; value: number }>
}

interface MetricCard {
  label: string
  value: number | string
  icon: React.ReactNode
  format?: 'number' | 'currency'
  variant?: 'default' | 'warning' | 'danger'
}

// ============================================
// Helpers
// ============================================

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`
  return `$${val.toLocaleString()}`
}

const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const TASK_STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-muted-foreground/20 text-muted-foreground',
  IN_PROGRESS: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

// ============================================
// Sub-Components
// ============================================

function MetricCardDisplay({ card }: { card: MetricCard }) {
  const displayValue =
    card.format === 'currency'
      ? formatCurrency(Number(card.value))
      : card.format === 'number'
        ? Number(card.value).toLocaleString()
        : card.value

  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-center gap-3'>
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
              card.variant === 'danger'
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : card.variant === 'warning'
                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-primary/10 text-primary'
            }`}
          >
            {card.icon}
          </div>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-xs text-muted-foreground'>{card.label}</p>
            <p className='text-xl font-semibold leading-tight'>{displayValue}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page
// ============================================

export default function CRMDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch<{ success: boolean; data: DashboardData }>(
        '/api/v1/crm/dashboard'
      )
      setData(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // ---- Loading State ----
  if (loading) {
    return (
      <div className='space-y-6'>
        <div>
          <Skeleton className='h-8 w-40' />
          <Skeleton className='mt-1 h-4 w-60' />
        </div>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'>
          {Array.from({ length: 9 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    )
  }

  // ---- Error State ----
  if (error || !data) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>CRM Dashboard</h1>
          <p className='text-muted-foreground mt-1'>Overview of your sales pipeline</p>
        </div>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertTriangle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>{error || 'Failed to load dashboard data'}</p>
            <button
              onClick={fetchDashboard}
              className='mt-2 text-sm text-primary underline-offset-4 hover:underline'
            >
              Try again
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Build Metric Cards ----
  const metricCards: MetricCard[] = [
    {
      label: 'Total Leads',
      value: data.leads.total,
      icon: <Users className='size-4' />,
      format: 'number',
    },
    {
      label: 'New Leads',
      value: data.leads.new,
      icon: <UserPlus className='size-4' />,
      format: 'number',
    },
    {
      label: 'Qualified Leads',
      value: data.leads.qualified,
      icon: <UserCheck className='size-4' />,
      format: 'number',
    },
    {
      label: 'Open Deals',
      value: data.deals.open,
      icon: <Handshake className='size-4' />,
      format: 'number',
    },
    {
      label: 'Pipeline Value',
      value: data.deals.pipelineValue,
      icon: <DollarSign className='size-4' />,
      format: 'currency',
    },
    {
      label: 'Won Deals Value',
      value: data.deals.wonDealsValue,
      icon: <Trophy className='size-4' />,
      format: 'currency',
    },
    {
      label: "Today's Follow-ups",
      value: data.followUps.today,
      icon: <Clock className='size-4' />,
      format: 'number',
    },
    {
      label: 'Overdue Follow-ups',
      value: data.followUps.overdue,
      icon: <AlertTriangle className='size-4' />,
      format: 'number',
      variant: data.followUps.overdue > 0 ? 'danger' : 'default',
    },
    {
      label: "Today's Calls",
      value: data.calls.today,
      icon: <Phone className='size-4' />,
      format: 'number',
    },
  ]

  // ---- Tasks by Status ----
  const taskEntries = Object.entries(data.tasksByStatus ?? {}).filter(
    ([status]) => status !== 'CANCELLED'
  )
  const totalTasks = taskEntries.reduce((sum, [, count]) => sum + count, 0)

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>CRM Dashboard</h1>
        <p className='text-muted-foreground mt-1'>
          Overview of your sales pipeline and activities
        </p>
      </div>

      {/* Metric Cards */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5'>
        {metricCards.map((card) => (
          <MetricCardDisplay key={card.label} card={card} />
        ))}
      </div>

      {/* Charts Row */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Deals by Stage Bar Chart */}
        <Card>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <ArrowUpRight className='size-4 text-muted-foreground' />
              <CardTitle className='text-base'>Deals by Stage</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {(data.dealsByStage?.length ?? 0) > 0 ? (
              <DealsStageChart data={data.dealsByStage ?? []} />
            ) : (
              <div className='flex h-64 items-center justify-center text-sm text-muted-foreground'>
                No deal data available yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tasks by Status */}
        <Card>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <Activity className='size-4 text-muted-foreground' />
              <CardTitle className='text-base'>Tasks by Status</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {taskEntries.length > 0 ? (
              <div className='space-y-4'>
                {taskEntries.map(([status, count]) => {
                  const pct = totalTasks > 0 ? (count / totalTasks) * 100 : 0
                  return (
                    <div key={status} className='space-y-1.5'>
                      <div className='flex items-center justify-between text-sm'>
                        <span className='text-muted-foreground'>
                          {TASK_STATUS_LABELS[status] || status}
                        </span>
                        <span className='font-medium'>{count}</span>
                      </div>
                      <div className='h-2.5 w-full overflow-hidden rounded-full bg-secondary'>
                        <div
                          className={`h-full rounded-full transition-all ${
                            status === 'COMPLETED'
                              ? 'bg-emerald-500'
                              : status === 'IN_PROGRESS'
                                ? 'bg-sky-500'
                                : 'bg-muted-foreground/60'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                <div className='pt-2 text-xs text-muted-foreground'>
                  Total tasks: {totalTasks}
                </div>
              </div>
            ) : (
              <div className='flex h-64 items-center justify-center text-sm text-muted-foreground'>
                No task data available yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activities Placeholder */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex flex-col items-center justify-center py-8 text-center'>
            <Activity className='mb-3 size-10 text-muted-foreground/40' />
            <p className='text-sm font-medium text-muted-foreground'>No recent activities</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              Activities will appear here as you interact with leads and deals.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
