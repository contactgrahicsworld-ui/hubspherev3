'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  TrendingUp,
  AlertTriangle,
  Filter,
  BarChart3,
  Target,
  Phone,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface CRMAnalyticsData {
  leadSourcePerformance: Array<{
    source: string
    leads: number
    converted: number
    conversionRate: number
  }>
  salesFunnel: Array<{
    stage: string
    count: number
    value: number
  }>
  winLossRates: {
    totalDeals: number
    won: number
    lost: number
    winRate: number
    lossRate: number
  }
  followUpStats: {
    total: number
    completed: number
    pending: number
    overdue: number
    completionRate: number
  }
}

// ============================================
// Constants
// ============================================

const STAGE_LABELS: Record<string, string> = {
  NEW: 'New',
  QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
}

const STAGE_COLORS: Record<string, string> = {
  NEW: 'bg-sky-500',
  QUALIFIED: 'bg-emerald-500',
  PROPOSAL: 'bg-amber-500',
  NEGOTIATION: 'bg-orange-500',
  WON: 'bg-green-600',
  LOST: 'bg-red-500',
}

// ============================================
// Helpers
// ============================================

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`
  return `$${val.toLocaleString()}`
}

// ============================================
// Sub-Components
// ============================================

function MetricCardSkeleton() {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-center gap-3'>
          <Skeleton className='size-9 rounded-lg' />
          <div className='flex-1 space-y-1'>
            <Skeleton className='h-3 w-24' />
            <Skeleton className='h-6 w-16' />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page
// ============================================

export default function CRMAnalyticsPage() {
  const [data, setData] = useState<CRMAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      const qs = params.toString()
      const res = await apiFetch<{ success: boolean; data: CRMAnalyticsData }>(
        `/api/v1/analytics/crm${qs ? `?${qs}` : ''}`
      )
      setData(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load CRM analytics'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // ---- Loading State ----
  if (loading) {
    return (
      <div className='space-y-6'>
        <div>
          <Skeleton className='h-8 w-44' />
          <Skeleton className='mt-1 h-4 w-64' />
        </div>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
          <Skeleton className='h-9 w-40' />
          <Skeleton className='h-9 w-40' />
          <Skeleton className='h-9 w-24' />
        </div>
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
        <Card>
          <CardHeader className='pb-2'>
            <Skeleton className='h-5 w-40' />
          </CardHeader>
          <CardContent>
            <div className='space-y-3'>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className='flex gap-3'>
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='h-2 flex-1' />
                  <Skeleton className='h-4 w-8' />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <Skeleton className='h-5 w-44' />
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className='h-10 w-full' />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Error State ----
  if (error || !data) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>CRM Analytics</h1>
          <p className='text-muted-foreground mt-1'>Lead sources, funnel, and deal performance</p>
        </div>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertTriangle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>{error || 'Failed to load CRM analytics data'}</p>
            <button
              onClick={fetchAnalytics}
              className='mt-2 text-sm text-primary underline-offset-4 hover:underline'
            >
              Try again
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Computed ----
  const funnel = data.salesFunnel ?? []
  const maxFunnelCount = funnel.length > 0 ? Math.max(...funnel.map((s) => s.count)) : 1
  const sources = data.leadSourcePerformance ?? []
  const wl = data.winLossRates
  const fu = data.followUpStats

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>CRM Analytics</h1>
          <p className='text-muted-foreground mt-1'>
            Lead sources, funnel, and deal performance
          </p>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
        <div className='space-y-1'>
          <label className='text-xs font-medium text-muted-foreground'>From</label>
          <Input
            type='date'
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className='w-full sm:w-44'
          />
        </div>
        <div className='space-y-1'>
          <label className='text-xs font-medium text-muted-foreground'>To</label>
          <Input
            type='date'
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className='w-full sm:w-44'
          />
        </div>
        <Button variant='outline' size='sm' onClick={fetchAnalytics}>
          <Filter className='size-4' />
          Apply
        </Button>
      </div>

      {/* Win/Loss + Follow-up KPIs */}
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <BarChart3 className='size-4' />
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-xs text-muted-foreground'>Win Rate</p>
                <p className='text-xl font-semibold leading-tight'>{wl.winRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'>
                <TrendingUp className='size-4' />
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-xs text-muted-foreground'>Loss Rate</p>
                <p className='text-xl font-semibold leading-tight'>{wl.lossRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'>
                <Target className='size-4' />
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-xs text-muted-foreground'>Follow-up Done</p>
                <p className='text-xl font-semibold leading-tight'>{fu.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'>
                <Phone className='size-4' />
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-xs text-muted-foreground'>Overdue</p>
                <p className='text-xl font-semibold leading-tight'>{fu.overdue}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Sales Funnel */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Sales Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {funnel.length > 0 ? (
              <div className='space-y-3'>
                {funnel.map((stage) => {
                  const pct = maxFunnelCount > 0 ? (stage.count / maxFunnelCount) * 100 : 0
                  return (
                    <div key={stage.stage} className='space-y-1'>
                      <div className='flex items-center justify-between text-sm'>
                        <span className='text-muted-foreground'>
                          {STAGE_LABELS[stage.stage] || stage.stage}
                        </span>
                        <span className='font-medium'>
                          {stage.count}{' '}
                          <span className='text-xs text-muted-foreground'>
                            ({formatCurrency(stage.value)})
                          </span>
                        </span>
                      </div>
                      <div className='h-2.5 w-full overflow-hidden rounded-full bg-secondary'>
                        <div
                          className={`h-full rounded-full transition-all ${STAGE_COLORS[stage.stage] || 'bg-primary'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className='flex h-48 items-center justify-center text-sm text-muted-foreground'>
                No funnel data available yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Win/Loss Breakdown */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Win / Loss Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-muted-foreground'>Total Deals</span>
                <span className='text-sm font-semibold'>{wl.totalDeals}</span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-muted-foreground'>Won</span>
                <Badge className='bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'>
                  {wl.won} ({wl.winRate}%)
                </Badge>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-muted-foreground'>Lost</span>
                <Badge className='bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'>
                  {wl.lost} ({wl.lossRate}%)
                </Badge>
              </div>
              <div className='h-3 w-full overflow-hidden rounded-full bg-secondary'>
                <div className='flex h-full'>
                  <div
                    className='h-full bg-emerald-500 transition-all'
                    style={{ width: `${wl.winRate}%` }}
                  />
                  <div
                    className='h-full bg-red-500 transition-all'
                    style={{ width: `${wl.lossRate}%` }}
                  />
                </div>
              </div>
              <div className='pt-2'>
                <p className='text-xs font-medium text-muted-foreground'>Follow-up Stats</p>
                <div className='mt-2 grid grid-cols-2 gap-2'>
                  <div className='rounded-lg border p-2 text-center'>
                    <p className='text-sm font-semibold'>{fu.total}</p>
                    <p className='text-[10px] text-muted-foreground'>Total</p>
                  </div>
                  <div className='rounded-lg border p-2 text-center'>
                    <p className='text-sm font-semibold'>{fu.pending}</p>
                    <p className='text-[10px] text-muted-foreground'>Pending</p>
                  </div>
                  <div className='rounded-lg border p-2 text-center'>
                    <p className='text-sm font-semibold'>{fu.completed}</p>
                    <p className='text-[10px] text-muted-foreground'>Completed</p>
                  </div>
                  <div className='rounded-lg border p-2 text-center'>
                    <p className='text-sm font-semibold'>{fu.completionRate}%</p>
                    <p className='text-[10px] text-muted-foreground'>Completion</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lead Source Performance Table */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Lead Source Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {sources.length > 0 ? (
            <>
              {/* Mobile card view */}
              <div className='space-y-3 md:hidden'>
                {sources.map((s) => (
                  <div key={s.source} className='rounded-lg border p-3 space-y-2'>
                    <p className='font-medium text-sm'>{s.source}</p>
                    <div className='grid grid-cols-3 gap-2 text-sm'>
                      <div>
                        <p className='text-xs text-muted-foreground'>Leads</p>
                        <p className='font-medium'>{s.leads}</p>
                      </div>
                      <div>
                        <p className='text-xs text-muted-foreground'>Converted</p>
                        <p className='font-medium'>{s.converted}</p>
                      </div>
                      <div>
                        <p className='text-xs text-muted-foreground'>Conversion</p>
                        <Badge
                          variant='outline'
                          className={
                            s.conversionRate >= 30
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs'
                              : s.conversionRate >= 15
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs'
                          }
                        >
                          {s.conversionRate}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table view */}
              <div className='hidden md:block max-h-96 overflow-y-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className='text-right'>Leads</TableHead>
                    <TableHead className='text-right'>Converted</TableHead>
                    <TableHead className='text-right'>Conversion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((s) => (
                    <TableRow key={s.source}>
                      <TableCell className='font-medium'>{s.source}</TableCell>
                      <TableCell className='text-right'>{s.leads}</TableCell>
                      <TableCell className='text-right'>{s.converted}</TableCell>
                      <TableCell className='text-right'>
                        <Badge
                          variant='outline'
                          className={
                            s.conversionRate >= 30
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : s.conversionRate >= 15
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }
                        >
                          {s.conversionRate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </>
          ) : (
            <div className='flex flex-col items-center justify-center py-8 text-center'>
              <BarChart3 className='mb-3 size-10 text-muted-foreground/40' />
              <p className='text-sm font-medium text-muted-foreground'>No lead source data available</p>
              <p className='mt-1 text-xs text-muted-foreground'>
                Data will appear once leads are created and assigned sources.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
