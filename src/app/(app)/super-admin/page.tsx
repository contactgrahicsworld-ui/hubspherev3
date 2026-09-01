'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, Users, CreditCard, ScrollText, AlertCircle } from 'lucide-react'

interface Stats {
  totalTenants: number
  totalUsers: number
  activeSubscriptions: number
  auditEvents: number
}

const statCards = [
  {
    key: 'totalTenants' as const,
    label: 'Total Tenants',
    icon: Building2,
    description: 'Registered tenants on the platform',
  },
  {
    key: 'totalUsers' as const,
    label: 'Total Users',
    icon: Users,
    description: 'Users across all tenants',
  },
  {
    key: 'activeSubscriptions' as const,
    label: 'Active Subscriptions',
    icon: CreditCard,
    description: 'Currently active subscriptions',
  },
  {
    key: 'auditEvents' as const,
    label: 'Audit Events',
    icon: ScrollText,
    description: 'Total audit log entries',
  },
]

function StatsSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className='h-4 w-28' />
            <Skeleton className='h-3 w-40' />
          </CardHeader>
          <CardContent>
            <Skeleton className='h-8 w-16' />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch<{ success: boolean; data: { tenants: { total: number; suspended: number }; users: { total: number; active: number }; auditLogs: number } }>('/api/v1/super-admin/stats')
      const raw = res.data
      const stats: Stats = {
        totalTenants: raw.tenants.total,
        totalUsers: raw.users.total,
        activeSubscriptions: 0,
        auditEvents: raw.auditLogs,
      }
      setStats(stats)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load stats'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const hasData = stats && (stats.totalTenants > 0 || stats.totalUsers > 0 || stats.activeSubscriptions > 0 || stats.auditEvents > 0)

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Super Admin Dashboard</h1>
        <p className='text-muted-foreground mt-1'>
          Platform overview and system statistics
        </p>
      </div>

      {loading && <StatsSkeleton />}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-6 text-center'>
            <AlertCircle className='size-5 text-destructive shrink-0' />
            <p className='text-sm text-destructive'>{error}</p>
            <button
              onClick={fetchStats}
              className='mt-2 text-sm text-primary underline-offset-4 hover:underline'
            >
              Try again
            </button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && stats && (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {statCards.map((card) => {
            const Icon = card.icon
            return (
              <Card key={card.key}>
                <CardHeader>
                  <div className='flex items-center gap-2'>
                    <Icon className='size-4 text-muted-foreground' />
                    <CardTitle className='text-sm font-medium'>{card.label}</CardTitle>
                  </div>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className='text-3xl font-bold'>{stats[card.key]}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {!loading && !error && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Quick Overview</CardTitle>
            <CardDescription>Platform status and guidance</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <div className='flex flex-col items-center justify-center py-8 text-center'>
                <Building2 className='size-10 text-muted-foreground/50 mb-3' />
                <p className='text-sm font-medium text-muted-foreground'>No data yet</p>
                <p className='text-xs text-muted-foreground mt-1'>
                  Get started by creating the first tenant or inviting users.
                </p>
              </div>
            ) : (
              <p className='text-sm text-muted-foreground'>
                Use the sidebar navigation to manage tenants, users, roles, audit logs, and more.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
