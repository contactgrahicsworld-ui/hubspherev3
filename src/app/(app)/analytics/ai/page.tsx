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
  Brain,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Bot,
} from 'lucide-react'
import { MetricCardSkeleton } from '@/components/skeletons'

// ============================================
// Types
// ============================================

interface AIUsageAnalyticsData {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  successRate: number
  averageLatency: number
  requestsByAgent: Array<{
    agentName: string
    requests: number
    successful: number
    failed: number
  }>
  requestsByModel: Array<{
    modelName: string
    requests: number
    successful: number
    failed: number
    avgLatency: number
  }>
}

// ============================================
// Helpers
// ============================================

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
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

export default function AIUsageAnalyticsPage() {
  const [data, setData] = useState<AIUsageAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch<{ success: boolean; data: AIUsageAnalyticsData }>(
        '/api/v1/analytics/ai-usage'
      )
      setData(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load AI usage analytics'
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
          <Skeleton className='h-8 w-44' />
          <Skeleton className='mt-1 h-4 w-64' />
        </div>
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5'>
          {Array.from({ length: 5 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='h-5 w-40' />
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
        </div>
      </div>
    )
  }

  // ---- Error State ----
  if (error || !data) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>AI Usage Analytics</h1>
          <p className='text-muted-foreground mt-1'>Request counts, latency, and usage by agent/model</p>
        </div>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertTriangle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>{error || 'Failed to load AI usage data'}</p>
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

  const byAgent = data.requestsByAgent ?? []
  const byModel = data.requestsByModel ?? []

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>AI Usage Analytics</h1>
          <p className='text-muted-foreground mt-1'>Request counts, latency, and usage by agent/model</p>
        </div>
        <Button variant='outline' size='sm' onClick={fetchData}>
          <RefreshCw className='size-4' />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5'>
        <KPICard
          label='Total Requests'
          value={data.totalRequests.toLocaleString()}
          icon={<Brain className='size-4' />}
        />
        <KPICard
          label='Successful'
          value={data.successfulRequests.toLocaleString()}
          icon={<CheckCircle className='size-4' />}
          variant='success'
        />
        <KPICard
          label='Failed'
          value={data.failedRequests.toLocaleString()}
          icon={<XCircle className='size-4' />}
          variant={data.failedRequests > 0 ? 'danger' : 'default'}
        />
        <KPICard
          label='Success Rate'
          value={`${data.successRate}%`}
          icon={<Bot className='size-4' />}
          variant={data.successRate >= 80 ? 'success' : data.successRate >= 50 ? 'warning' : 'danger'}
        />
        <KPICard
          label='Avg Latency'
          value={formatLatency(data.averageLatency)}
          icon={<Clock className='size-4' />}
          variant='warning'
        />
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Requests By Agent */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Requests by Agent</CardTitle>
          </CardHeader>
          <CardContent>
            {byAgent.length > 0 ? (
              <>
                {/* Mobile card view */}
                <div className='space-y-3 md:hidden'>
                  {byAgent.map((agent) => (
                    <div key={agent.agentName} className='rounded-lg border p-3 space-y-2'>
                      <p className='font-medium text-sm'>{agent.agentName}</p>
                      <div className='flex items-center justify-between text-sm'>
                        <span className='text-muted-foreground'>Requests</span>
                        <span className='font-medium'>{agent.requests}</span>
                      </div>
                      <div className='flex gap-3 text-sm'>
                        <div className='flex items-center gap-1.5'>
                          <Badge className='bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs'>
                            {agent.successful} success
                          </Badge>
                        </div>
                        <div className='flex items-center gap-1.5'>
                          {agent.failed > 0 ? (
                            <Badge className='bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs'>
                              {agent.failed} failed
                            </Badge>
                          ) : (
                            <span className='text-xs text-muted-foreground'>0 failed</span>
                          )}
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
                      <TableHead className='text-right'>Requests</TableHead>
                      <TableHead className='text-right'>Success</TableHead>
                      <TableHead className='text-right'>Failed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byAgent.map((agent) => (
                      <TableRow key={agent.agentName}>
                        <TableCell className='font-medium'>{agent.agentName}</TableCell>
                        <TableCell className='text-right'>{agent.requests}</TableCell>
                        <TableCell className='text-right'>
                          <Badge className='bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'>
                            {agent.successful}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right'>
                          {agent.failed > 0 ? (
                            <Badge className='bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'>
                              {agent.failed}
                            </Badge>
                          ) : (
                            <span className='text-muted-foreground'>0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div></>
            ) : (
              <div className='flex flex-col items-center justify-center py-8 text-center'>
                <Bot className='mb-3 size-10 text-muted-foreground/40' />
                <p className='text-sm font-medium text-muted-foreground'>No agent usage data available</p>
                <p className='mt-1 text-xs text-muted-foreground'>Data will appear once AI agents are used.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requests By Model */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Requests by Model</CardTitle>
          </CardHeader>
          <CardContent>
            {byModel.length > 0 ? (
              <>
                {/* Mobile card view */}
                <div className='space-y-3 md:hidden'>
                  {byModel.map((model) => (
                    <div key={model.modelName} className='rounded-lg border p-3 space-y-2'>
                      <p className='font-medium text-sm'>{model.modelName}</p>
                      <div className='flex items-center justify-between text-sm'>
                        <span className='text-muted-foreground'>Requests</span>
                        <span className='font-medium'>{model.requests}</span>
                      </div>
                      <div className='flex items-center justify-between text-sm'>
                        <span className='text-muted-foreground'>Success</span>
                        <Badge className='bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs'>
                          {model.successful}
                        </Badge>
                      </div>
                      <div className='flex items-center justify-between text-sm'>
                        <span className='text-muted-foreground'>Avg Latency</span>
                        <span className='font-medium'>{formatLatency(model.avgLatency)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop table view */}
                <div className='hidden md:block max-h-96 overflow-y-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead className='text-right'>Requests</TableHead>
                      <TableHead className='text-right'>Success</TableHead>
                      <TableHead className='text-right'>Avg Latency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byModel.map((model) => (
                      <TableRow key={model.modelName}>
                        <TableCell className='font-medium'>{model.modelName}</TableCell>
                        <TableCell className='text-right'>{model.requests}</TableCell>
                        <TableCell className='text-right'>
                          <Badge className='bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'>
                            {model.successful}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right'>{formatLatency(model.avgLatency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div></>
            ) : (
              <div className='flex flex-col items-center justify-center py-8 text-center'>
                <Brain className='mb-3 size-10 text-muted-foreground/40' />
                <p className='text-sm font-medium text-muted-foreground'>No model usage data available</p>
                <p className='mt-1 text-xs text-muted-foreground'>Data will appear once AI models are called.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
