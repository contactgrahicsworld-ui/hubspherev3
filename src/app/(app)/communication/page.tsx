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
  AlertCircle,
  RefreshCw,
  Clock,
  ExternalLink,
  Radio,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

// ============================================
// Types
// ============================================

interface DashboardData {
  totalConversations: number
  unreadMessages: number
  messagesToday: number
  activeTemplates: number
  recentConversations: {
    id: string
    participantName: string
    lastMessage: string | null
    lastMessageAt: string | null
    channel: string
    unreadCount: number
    status: string
  }[]
  channelDistribution: {
    WHATSAPP: number
    EMAIL: number
    SMS: number
    IN_APP: number
  }
  providerStatus: {
    WHATSAPP: { status: string; provider: string | null }
    EMAIL: { status: string; provider: string | null }
    SMS: { status: string; provider: string | null }
    PUSH: { status: string; provider: string | null }
  }
}

interface MetricCard {
  label: string
  value: number
  icon: React.ReactNode
  variant?: 'default' | 'warning' | 'danger' | 'success'
}

// ============================================
// Constants
// ============================================

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  WHATSAPP: <MessageSquare className='size-3.5' />,
  EMAIL: <Mail className='size-3.5' />,
  SMS: <Smartphone className='size-3.5' />,
  IN_APP: <Bell className='size-3.5' />,
  PUSH: <Bell className='size-3.5' />,
}

const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  SMS: 'SMS',
  IN_APP: 'In-App',
  PUSH: 'Push',
}

const CHANNEL_BADGE_STYLES: Record<string, string> = {
  WHATSAPP: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  EMAIL: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  SMS: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  IN_APP: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  PUSH: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
}

const PROVIDER_STATUS_STYLES: Record<string, string> = {
  NOT_CONFIGURED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CONFIGURED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ENABLED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

const PROVIDER_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email (SMTP)',
  SMS: 'SMS Gateway',
  PUSH: 'Push Notifications',
}

// ============================================
// Helpers
// ============================================

function formatTime(dateStr: string | null): string {
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

function MetricCardDisplay({ card }: { card: MetricCard }) {
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
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
              variantClasses[card.variant ?? 'default']
            }`}
          >
            {card.icon}
          </div>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-xs text-muted-foreground'>{card.label}</p>
            <p className='text-xl font-semibold leading-tight'>
              {card.value.toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ConversationRowSkeleton() {
  return (
    <div className='flex items-center gap-3 px-4 py-3'>
      <Skeleton className='size-8 rounded-full' />
      <div className='flex-1 space-y-1.5'>
        <Skeleton className='h-4 w-32' />
        <Skeleton className='h-3 w-48' />
      </div>
      <Skeleton className='h-3 w-16' />
    </div>
  )
}

function ProviderCardSkeleton() {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <Skeleton className='size-8 rounded-lg' />
            <div className='space-y-1.5'>
              <Skeleton className='h-4 w-28' />
              <Skeleton className='h-3 w-20' />
            </div>
          </div>
          <Skeleton className='h-6 w-28' />
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page
// ============================================

export default function CommunicationDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dbUnavailable, setDbUnavailable] = useState(false)

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setDbUnavailable(false)
      const res = await apiFetch<{ success: boolean; data: DashboardData }>(
        '/api/v1/communication/dashboard'
      )
      setData(res.data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard'
      if (msg.includes('Database unavailable') || msg.includes('503')) {
        setDbUnavailable(true)
        setError('Database is currently unavailable. Please try again later.')
      } else {
        setError(msg)
      }
      toast.error(msg)
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
          <Skeleton className='h-8 w-56' />
          <Skeleton className='mt-1 h-4 w-72' />
        </div>
        <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
        <Card>
          <CardHeader className='pb-2'>
            <Skeleton className='h-5 w-44' />
          </CardHeader>
          <CardContent className='space-y-1'>
            {Array.from({ length: 5 }).map((_, i) => (
              <ConversationRowSkeleton key={i} />
            ))}
          </CardContent>
        </Card>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <ProviderCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  // ---- Error / DB Unavailable State ----
  if (error || !data) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Communication</h1>
          <p className='mt-1 text-muted-foreground'>
            Manage messaging channels and conversations
          </p>
        </div>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertCircle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>
              {dbUnavailable
                ? 'Service Temporarily Unavailable'
                : error || 'Failed to load dashboard data'}
            </p>
            {dbUnavailable && (
              <p className='text-xs text-muted-foreground'>
                The database is not responding. This is usually a temporary issue.
              </p>
            )}
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

  // ---- Metric Cards ----
  const metricCards: MetricCard[] = [
    {
      label: 'Total Conversations',
      value: data.totalConversations,
      icon: <MessageSquare className='size-4' />,
    },
    {
      label: 'Unread Messages',
      value: data.unreadMessages,
      icon: <Mail className='size-4' />,
      variant: data.unreadMessages > 0 ? 'warning' : 'success',
    },
    {
      label: 'Messages Today',
      value: data.messagesToday,
      icon: <Clock className='size-4' />,
      variant: 'default',
    },
    {
      label: 'Active Templates',
      value: data.activeTemplates,
      icon: <Radio className='size-4' />,
      variant: data.activeTemplates > 0 ? 'success' : 'default',
    },
  ]

  // ---- Channel Distribution ----
  const channels = [
    { key: 'WHATSAPP', count: data.channelDistribution.WHATSAPP },
    { key: 'EMAIL', count: data.channelDistribution.EMAIL },
    { key: 'SMS', count: data.channelDistribution.SMS },
    { key: 'IN_APP', count: data.channelDistribution.IN_APP },
  ]

  // ---- Provider Status ----
  const providers = Object.entries(data.providerStatus) as [
    string,
    { status: string; provider: string | null },
  ][]

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Communication</h1>
          <p className='mt-1 text-muted-foreground'>
            Manage messaging channels and conversations
          </p>
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={fetchDashboard}
        >
          <RefreshCw className='size-4' />
          Refresh
        </Button>
      </div>

      {/* Metric Cards */}
      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        {metricCards.map((card) => (
          <MetricCardDisplay key={card.label} card={card} />
        ))}
      </div>

      {/* Recent Conversations + Channel Distribution */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        {/* Recent Conversations */}
        <Card className='lg:col-span-2'>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-base'>Recent Conversations</CardTitle>
            <Button
              variant='ghost'
              size='sm'
              className='text-xs'
              onClick={() => router.push('/communication/inbox')}
            >
              View all
              <ExternalLink className='ml-1 size-3' />
            </Button>
          </CardHeader>
          <CardContent className='p-0'>
            {data.recentConversations.length > 0 ? (
              <div className='divide-y'>
                {data.recentConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => router.push(`/communication/inbox?id=${conv.id}`)}
                    className='flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50'
                  >
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                        CHANNEL_BADGE_STYLES[conv.channel] || 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {CHANNEL_ICONS[conv.channel] || <MessageSquare className='size-3.5' />}
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2'>
                        <span className='truncate text-sm font-medium'>
                          {conv.participantName || 'Unknown'}
                        </span>
                        {conv.unreadCount > 0 && (
                          <span className='flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground'>
                            {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className='truncate text-xs text-muted-foreground'>
                        {conv.lastMessage || 'No messages yet'}
                      </p>
                    </div>
                    <div className='flex shrink-0 flex-col items-end gap-1'>
                      <span className='text-[11px] text-muted-foreground'>
                        {formatTime(conv.lastMessageAt)}
                      </span>
                      <Badge
                        variant='outline'
                        className={`text-[10px] ${CHANNEL_BADGE_STYLES[conv.channel] || ''}`}
                      >
                        {CHANNEL_LABELS[conv.channel] || conv.channel}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className='flex flex-col items-center justify-center py-12 text-center'>
                <MessageSquare className='mb-3 size-10 text-muted-foreground/40' />
                <p className='text-sm font-medium text-muted-foreground'>
                  No conversations yet
                </p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  Start a conversation from the inbox
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Channel Distribution */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Channel Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-3'>
              {channels.map(({ key, count }) => (
                <div key={key} className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <Badge
                      variant='outline'
                      className={CHANNEL_BADGE_STYLES[key] || ''}
                    >
                      {CHANNEL_ICONS[key]}
                      <span className='ml-1'>{CHANNEL_LABELS[key]}</span>
                    </Badge>
                  </div>
                  <span className='text-sm font-semibold'>{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provider Status */}
      <div>
        <h2 className='mb-3 text-base font-semibold'>Provider Status</h2>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {providers.map(([key, info]) => (
            <Card key={key}>
              <CardContent className='p-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-3'>
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                        CHANNEL_BADGE_STYLES[key] || 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {CHANNEL_ICONS[key] || <Radio className='size-3.5' />}
                    </div>
                    <div>
                      <p className='text-sm font-medium'>
                        {PROVIDER_LABELS[key] || key}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {info.provider || 'Not set'}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant='outline'
                    className={
                      PROVIDER_STATUS_STYLES[info.status] ||
                      'bg-muted text-muted-foreground'
                    }
                  >
                    {info.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
