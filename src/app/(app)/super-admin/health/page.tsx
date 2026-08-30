'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  Database,
  Clock,
  Server,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from 'lucide-react'

interface HealthData {
  status: string
  uptime: number
  timestamp: string
  database?: {
    status: string
    responseTime?: number
  }
  services?: Record<string, { status: string; details?: string }>
}

interface ProviderInfo {
  name: string
  provider: string
  configured: boolean
  details?: string
}

interface ProvidersData {
  providers: ProviderInfo[]
}

function StatusIndicator({ status }: { status: string }) {
  const s = status?.toLowerCase() || 'unknown'
  const isOk = s === 'ok' || s === 'healthy' || s === 'up' || s === 'active'
  const isWarn = s === 'degraded' || s === 'warning'

  if (isOk) {
    return (
      <div className='flex items-center gap-2'>
        <CheckCircle2 className='size-4 text-emerald-600 dark:text-emerald-400' />
        <span className='text-emerald-700 dark:text-emerald-300 text-sm font-medium'>Healthy</span>
      </div>
    )
  }
  if (isWarn) {
    return (
      <div className='flex items-center gap-2'>
        <MinusCircle className='size-4 text-amber-600 dark:text-amber-400' />
        <span className='text-amber-700 dark:text-amber-300 text-sm font-medium'>Degraded</span>
      </div>
    )
  }
  return (
    <div className='flex items-center gap-2'>
      <XCircle className='size-4 text-red-600 dark:text-red-400' />
      <span className='text-red-700 dark:text-red-300 text-sm font-medium'>{status || 'Down'}</span>
    </div>
  )
}

function HealthSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className='h-4 w-24' />
          </CardHeader>
          <CardContent>
            <Skeleton className='h-6 w-32' />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  parts.push(`${minutes}m`)
  return parts.join(' ')
}

export default function SystemHealth() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      try {
        setLoading(true)
        setError(null)

        const [healthData, providersData] = await Promise.allSettled([
          apiFetch<{ success: boolean; data: { status: string; timestamp: string; uptime: number; database?: string; message?: string } }>('/api/v1/system/health'),
          apiFetch<{ success: boolean; data: ProviderInfo[] }>('/api/v1/system/providers'),
        ])

        if (!cancelled) {
          if (healthData.status === 'fulfilled') {
            const raw = healthData.value.data
            setHealth({
              status: raw.status,
              uptime: raw.uptime,
              timestamp: raw.timestamp,
              database: raw.database ? { status: raw.database } : undefined,
            })
          }
          if (providersData.status === 'fulfilled') {
            setProviders(providersData.value.data || [])
          }
          if (healthData.status === 'rejected' && providersData.status === 'rejected') {
            throw healthData.reason
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load health data'
          setError(message)
          toast.error(message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>System Health</h1>
        <p className='text-muted-foreground mt-1'>Monitor platform health and service status</p>
      </div>

      {loading && <HealthSkeleton />}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 text-destructive shrink-0' />
            <p className='text-sm text-destructive'>{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && health && (
        <>
          {/* System Overview */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <Card>
              <CardHeader>
                <CardDescription>System Status</CardDescription>
              </CardHeader>
              <CardContent>
                <StatusIndicator status={health.status} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Uptime</CardDescription>
              </CardHeader>
              <CardContent>
                <div className='flex items-center gap-2'>
                  <Clock className='size-4 text-muted-foreground' />
                  <span className='text-sm font-medium'>{formatUptime(health.uptime)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Database</CardDescription>
              </CardHeader>
              <CardContent>
                <StatusIndicator status={health.database?.status || 'unknown'} />
                {health.database?.responseTime && (
                  <p className='text-xs text-muted-foreground mt-1'>
                    Response: {health.database.responseTime}ms
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Last Check</CardDescription>
              </CardHeader>
              <CardContent>
                <p className='text-sm text-muted-foreground'>
                  {health.timestamp
                    ? new Date(health.timestamp).toLocaleTimeString()
                    : '-'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Additional Services */}
          {health.services && Object.keys(health.services).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Services</CardTitle>
                <CardDescription>Internal service health status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                  {Object.entries(health.services).map(([name, svc]) => (
                    <div
                      key={name}
                      className='flex items-center justify-between rounded-md border p-3'
                    >
                      <div className='flex items-center gap-2'>
                        <Server className='size-4 text-muted-foreground' />
                        <span className='text-sm font-medium'>{name}</span>
                      </div>
                      <StatusIndicator status={svc.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Provider Status */}
      {!loading && providers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Provider Status</CardTitle>
            <CardDescription>External provider integration status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              {providers.map((provider) => (
                <div
                  key={provider.name}
                  className='flex items-center justify-between rounded-md border p-3'
                >
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-medium truncate'>{provider.name}</p>
                    <p className='text-xs text-muted-foreground truncate'>{provider.provider}</p>
                  </div>
                  {provider.configured ? (
                    <Badge variant='default' className='shrink-0 ml-2'>Configured</Badge>
                  ) : (
                    <Badge variant='outline' className='shrink-0 ml-2'>Not Set</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && !health && providers.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Activity className='size-10 text-muted-foreground/50 mb-3' />
            <p className='text-sm font-medium text-muted-foreground'>Health data unavailable</p>
            <p className='text-xs text-muted-foreground mt-1'>
              Unable to retrieve system health information.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
