'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Bot,
  Brain,
  Phone,
  TrendingUp,
  Users,
  BarChart3,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface AgentStatus {
  id: string
  name: string
  description: string
  status: 'ACTIVE' | 'INACTIVE' | 'NOT_CONFIGURED'
}

interface AIHubData {
  agents: AgentStatus[]
}

// ============================================
// Constants
// ============================================

const AGENT_ICONS: Record<string, React.ReactNode> = {
  NOVA: <Brain className='size-6' />,
  VOX: <Phone className='size-6' />,
  SALESPRO: <TrendingUp className='size-6' />,
  PEOPLEMIND: <Users className='size-6' />,
  INSIGHT: <BarChart3 className='size-6' />,
}

const AGENT_COLORS: Record<string, string> = {
  NOVA: 'bg-primary/10 text-primary',
  VOX: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  SALESPRO: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  PEOPLEMIND: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  INSIGHT: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  INACTIVE: 'bg-muted text-muted-foreground',
  NOT_CONFIGURED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  NOT_CONFIGURED: 'Not Configured',
}

// ============================================
// Sub-Components
// ============================================

function AgentCardSkeleton() {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-start gap-3'>
          <Skeleton className='size-10 rounded-lg' />
          <div className='min-w-0 flex-1 space-y-2'>
            <Skeleton className='h-5 w-28' />
            <Skeleton className='h-3 w-20 rounded-full' />
            <Skeleton className='h-12 w-full' />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page
// ============================================

export default function AIHubPage() {
  const router = useRouter()
  const [data, setData] = useState<AIHubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch<{ success: boolean; data: AIHubData }>(
        '/api/v1/ai/agents'
      )
      setData(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load AI agents'
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
          <Skeleton className='h-8 w-28' />
          <Skeleton className='mt-1 h-4 w-56' />
        </div>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 5 }).map((_, i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  // ---- Error State ----
  if (error || !data) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>AI Hub</h1>
          <p className='text-muted-foreground mt-1'>Your AI-powered assistants</p>
        </div>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertTriangle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>{error || 'Failed to load AI agents'}</p>
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

  const agents = data.agents ?? []

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>AI Hub</h1>
        <p className='text-muted-foreground mt-1'>Your AI-powered assistants</p>
      </div>

      {/* Agent Cards */}
      {agents.length > 0 ? (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {agents.map((agent) => {
            const canChat = agent.status === 'ACTIVE'
            return (
              <Card
                key={agent.id}
                className={canChat ? 'cursor-pointer transition-colors hover:bg-muted/50' : 'opacity-75'}
                onClick={() => canChat && router.push(`/ai/chat?agent=${agent.id}`)}
                role={canChat ? 'button' : undefined}
                tabIndex={canChat ? 0 : undefined}
                onKeyDown={(e) => {
                  if (canChat && e.key === 'Enter') router.push(`/ai/chat?agent=${agent.id}`)
                }}
              >
                <CardContent className='p-4'>
                  <div className='flex items-start gap-3'>
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                        AGENT_COLORS[agent.name] || 'bg-primary/10 text-primary'
                      }`}
                    >
                      {AGENT_ICONS[agent.name] || <Bot className='size-6' />}
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2'>
                        <p className='text-sm font-semibold'>{agent.name}</p>
                        <Badge
                          variant='outline'
                          className={`text-[10px] ${STATUS_STYLES[agent.status] || ''}`}
                        >
                          {STATUS_LABELS[agent.status] || agent.status}
                        </Badge>
                      </div>
                      <p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
                        {agent.description}
                      </p>
                      {canChat && (
                        <div className='mt-3 flex items-center gap-1 text-xs font-medium text-primary'>
                          <span>Start Chat</span>
                          <ArrowRight className='size-3' />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className='border-dashed'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <Bot className='size-10 text-muted-foreground/40' />
            <p className='text-sm font-medium text-muted-foreground'>No AI agents configured</p>
            <p className='text-xs text-muted-foreground'>
              Contact your administrator to set up AI agents.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
