'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MessageSquare,
  Mail,
  Smartphone,
  Bell,
  AlertTriangle,
  RefreshCw,
  Send,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import { MetricCardSkeleton } from '@/components/skeletons'

// ============================================
// Types
// ============================================

interface CommunicationAnalyticsData {
  messageStatusCounts: {
    sent: number
    delivered: number
    read: number
    failed: number
    pending: number
  }
  channelDistribution: {
    WHATSAPP: number
    EMAIL: number
    SMS: number
    IN_APP: number
  }
}

// ============================================
// Constants
// ============================================

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  WHATSAPP: <MessageSquare className='size-3.5' />,
  EMAIL: <Mail className='size-3.5' />,
  SMS: <Smartphone className='size-3.5' />,
  IN_APP: <Bell className='size-3.5' />,
}

const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  SMS: 'SMS',
  IN_APP: 'In-App',
}

const CHANNEL_BADGE_STYLES: Record<string, string> = {
  WHATSAPP: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  EMAIL: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  SMS: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  IN_APP: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
}

const STATUS_CONFIG: Array<{
  key: keyof CommunicationAnalyticsData['messageStatusCounts']
  label: string
  icon: React.ReactNode
  colorClass: string
}> = [
  {
    key: 'sent',
    label: 'Sent',
    icon: <Send className='size-4' />,
    colorClass: 'bg-primary/10 text-primary',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    icon: <CheckCircle className='size-4' />,
    colorClass: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  },
  {
    key: 'read',
    label: 'Read',
    icon: <CheckCircle className='size-4' />,
    colorClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  {
    key: 'failed',
    label: 'Failed',
    icon: <XCircle className='size-4' />,
    colorClass: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  },
  {
    key: 'pending',
    label: 'Pending',
    icon: <Clock className='size-4' />,
    colorClass: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  },
]


// ============================================
// Main Page
// ============================================

export default function CommunicationAnalyticsPage() {
  const [data, setData] = useState<CommunicationAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch<{ success: boolean; data: CommunicationAnalyticsData }>(
        '/api/v1/analytics/communication'
      )
      setData(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load communication analytics'
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
          <Skeleton className='h-8 w-56' />
          <Skeleton className='mt-1 h-4 w-72' />
        </div>
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5'>
          {Array.from({ length: 5 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
        <Card>
          <CardHeader className='pb-2'>
            <Skeleton className='h-5 w-44' />
          </CardHeader>
          <CardContent>
            <div className='space-y-3'>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className='flex items-center gap-3'>
                  <Skeleton className='size-6 rounded' />
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='ml-auto h-4 w-8' />
                </div>
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
          <h1 className='text-2xl font-bold tracking-tight'>Communication Analytics</h1>
          <p className='text-muted-foreground mt-1'>Message status and channel distribution</p>
        </div>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertTriangle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>{error || 'Failed to load communication data'}</p>
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

  // ---- Channel Distribution ----
  const channels = [
    { key: 'WHATSAPP', count: data.channelDistribution.WHATSAPP },
    { key: 'EMAIL', count: data.channelDistribution.EMAIL },
    { key: 'SMS', count: data.channelDistribution.SMS },
    { key: 'IN_APP', count: data.channelDistribution.IN_APP },
  ]
  const totalChannelMessages = channels.reduce((sum, c) => sum + c.count, 0)
  const maxChannelCount = Math.max(...channels.map((c) => c.count), 1)

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Communication Analytics</h1>
          <p className='text-muted-foreground mt-1'>Message status and channel distribution</p>
        </div>
        <Button variant='outline' size='sm' onClick={fetchData}>
          <RefreshCw className='size-4' />
          Refresh
        </Button>
      </div>

      {/* Message Status KPI Cards */}
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5'>
        {STATUS_CONFIG.map((s) => (
          <Card key={s.key}>
            <CardContent className='p-4'>
              <div className='flex items-center gap-3'>
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${s.colorClass}`}>
                  {s.icon}
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-xs text-muted-foreground'>{s.label}</p>
                  <p className='text-xl font-semibold leading-tight'>
                    {data.messageStatusCounts[s.key].toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Channel Distribution */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Channel Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {totalChannelMessages > 0 ? (
            <div className='space-y-3'>
              {channels.map(({ key, count }) => {
                const pct = (count / maxChannelCount) * 100
                const pctOfTotal = totalChannelMessages > 0 ? ((count / totalChannelMessages) * 100).toFixed(1) : '0.0'
                return (
                  <div key={key} className='space-y-1'>
                    <div className='flex items-center justify-between text-sm'>
                      <div className='flex items-center gap-2'>
                        <Badge variant='outline' className={CHANNEL_BADGE_STYLES[key] || ''}>
                          {CHANNEL_ICONS[key]}
                          <span className='ml-1'>{CHANNEL_LABELS[key]}</span>
                        </Badge>
                      </div>
                      <div className='flex items-center gap-2'>
                        <span className='font-medium'>{count}</span>
                        <span className='text-xs text-muted-foreground'>({pctOfTotal}%)</span>
                      </div>
                    </div>
                    <div className='h-2.5 w-full overflow-hidden rounded-full bg-secondary'>
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
            <div className='flex flex-col items-center justify-center py-8 text-center'>
              <MessageSquare className='mb-3 size-10 text-muted-foreground/40' />
              <p className='text-sm font-medium text-muted-foreground'>No message data available yet</p>
              <p className='mt-1 text-xs text-muted-foreground'>
                Data will appear once messages are sent across channels.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
