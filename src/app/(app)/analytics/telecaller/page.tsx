'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Phone,
  PhoneCall,
  PhoneMissed,
  Clock,
  AlertTriangle,
  RefreshCw,
  Mic,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface TelecallerAnalyticsData {
  totalCalls: number
  answeredCalls: number
  missedCalls: number
  averageDuration: number
  callsByAgent: Array<{
    agentName: string
    totalCalls: number
    answeredCalls: number
    missedCalls: number
    avgDuration: number
  }>
  recordingAvailability: {
    totalRecorded: number
    totalWithRecording: number
    availabilityRate: number
  }
}

// ============================================
// Helpers
// ============================================

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
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

export default function TelecallerAnalyticsPage() {
  const [data, setData] = useState<TelecallerAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch<{ success: boolean; data: TelecallerAnalyticsData }>(
        '/api/v1/analytics/telecaller'
      )
      setData(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load telecaller analytics'
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
        <Card>
          <CardHeader className='pb-2'>
            <Skeleton className='h-5 w-36' />
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className='h-10 w-full' />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <Skeleton className='h-5 w-48' />
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className='h-20 w-full rounded-lg' />
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
          <h1 className='text-2xl font-bold tracking-tight'>Telecaller Analytics</h1>
          <p className='text-muted-foreground mt-1'>Call volume and agent performance</p>
        </div>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertTriangle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>{error || 'Failed to load telecaller data'}</p>
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

  const answerRate = data.totalCalls > 0 ? ((data.answeredCalls / data.totalCalls) * 100).toFixed(1) : '0.0'
  const agents = data.callsByAgent ?? []
  const rec = data.recordingAvailability

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Telecaller Analytics</h1>
          <p className='text-muted-foreground mt-1'>Call volume and agent performance</p>
        </div>
        <Button variant='outline' size='sm' onClick={fetchData}>
          <RefreshCw className='size-4' />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
        <KPICard
          label='Total Calls'
          value={data.totalCalls.toLocaleString()}
          icon={<Phone className='size-4' />}
        />
        <KPICard
          label='Answered'
          value={data.answeredCalls.toLocaleString()}
          icon={<PhoneCall className='size-4' />}
          variant='success'
        />
        <KPICard
          label='Missed'
          value={data.missedCalls.toLocaleString()}
          icon={<PhoneMissed className='size-4' />}
          variant={data.missedCalls > 0 ? 'danger' : 'default'}
        />
        <KPICard
          label='Avg Duration'
          value={formatDuration(data.averageDuration)}
          icon={<Clock className='size-4' />}
          variant='warning'
        />
      </div>

      {/* Answer Rate */}
      <Card>
        <CardContent className='p-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <PhoneCall className='size-4 text-muted-foreground' />
              <span className='text-sm font-medium'>Answer Rate</span>
            </div>
            <span className='text-lg font-semibold'>{answerRate}%</span>
          </div>
          <div className='mt-2 h-2.5 w-full overflow-hidden rounded-full bg-secondary'>
            <div
              className='h-full rounded-full bg-primary transition-all'
              style={{ width: `${answerRate}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Calls Per Agent Table */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Calls Per Agent</CardTitle>
        </CardHeader>
        <CardContent>
          {agents.length > 0 ? (
            <>
              {/* Mobile card view */}
              <div className='space-y-3 md:hidden'>
                {agents.map((agent) => (
                  <div key={agent.agentName} className='rounded-lg border p-3 space-y-2'>
                    <p className='font-medium text-sm'>{agent.agentName}</p>
                    <div className='grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm'>
                      <div className='flex items-center justify-between'>
                        <span className='text-muted-foreground'>Total</span>
                        <span className='font-medium'>{agent.totalCalls}</span>
                      </div>
                      <div className='flex items-center justify-between'>
                        <span className='text-muted-foreground'>Answered</span>
                        <span className='font-medium text-emerald-600 dark:text-emerald-400'>{agent.answeredCalls}</span>
                      </div>
                      <div className='flex items-center justify-between'>
                        <span className='text-muted-foreground'>Missed</span>
                        {agent.missedCalls > 0 ? (
                          <Badge className='bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs'>
                            {agent.missedCalls}
                          </Badge>
                        ) : (
                          <span className='text-xs text-muted-foreground'>0</span>
                        )}
                      </div>
                      <div className='flex items-center justify-between'>
                        <span className='text-muted-foreground'>Avg Duration</span>
                        <span className='font-medium'>{formatDuration(agent.avgDuration)}</span>
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
                    <TableHead>Agent</TableHead>
                    <TableHead className='text-right'>Total</TableHead>
                    <TableHead className='text-right'>Answered</TableHead>
                    <TableHead className='text-right'>Missed</TableHead>
                    <TableHead className='text-right'>Avg Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => (
                    <TableRow key={agent.agentName}>
                      <TableCell className='font-medium'>{agent.agentName}</TableCell>
                      <TableCell className='text-right'>{agent.totalCalls}</TableCell>
                      <TableCell className='text-right'>{agent.answeredCalls}</TableCell>
                      <TableCell className='text-right'>
                        {agent.missedCalls > 0 ? (
                          <Badge className='bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'>
                            {agent.missedCalls}
                          </Badge>
                        ) : (
                          <span className='text-muted-foreground'>0</span>
                        )}
                      </TableCell>
                      <TableCell className='text-right'>{formatDuration(agent.avgDuration)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </>
          ) : (
            <div className='flex flex-col items-center justify-center py-8 text-center'>
              <Phone className='mb-3 size-10 text-muted-foreground/40' />
              <p className='text-sm font-medium text-muted-foreground'>No agent call data available</p>
              <p className='mt-1 text-xs text-muted-foreground'>
                Data will appear once calls are made by agents.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recording Availability */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Recording Availability</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
            <div className='flex items-center gap-2 rounded-lg border p-3'>
              <Mic className='size-4 text-muted-foreground' />
              <div>
                <p className='text-lg font-semibold'>{rec.totalRecorded}</p>
                <p className='text-[10px] text-muted-foreground'>Total Calls Recorded</p>
              </div>
            </div>
            <div className='flex items-center gap-2 rounded-lg border p-3'>
              <Mic className='size-4 text-emerald-500' />
              <div>
                <p className='text-lg font-semibold'>{rec.totalWithRecording}</p>
                <p className='text-[10px] text-muted-foreground'>With Recording</p>
              </div>
            </div>
            <div className='flex items-center gap-2 rounded-lg border p-3'>
              <Mic className='size-4 text-red-500' />
              <div>
                <p className='text-lg font-semibold'>{rec.totalRecorded - rec.totalWithRecording}</p>
                <p className='text-[10px] text-muted-foreground'>Without Recording</p>
              </div>
            </div>
            <div className='flex items-center gap-2 rounded-lg border p-3'>
              <PhoneCall className='size-4 text-primary' />
              <div>
                <p className='text-lg font-semibold'>{rec.availabilityRate}%</p>
                <p className='text-[10px] text-muted-foreground'>Availability Rate</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
