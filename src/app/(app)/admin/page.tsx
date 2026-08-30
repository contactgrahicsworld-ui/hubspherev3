'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  Shield,
  ScrollText,
  Settings,
  Building2,
  AlertCircle,
  Crown,
} from 'lucide-react'

interface MeResponse {
  id: string
  name: string
  email: string
  role: string
  tenantId: string
  tenantName: string
  tenantPlan: string
  memberCount: number
  permissionsCount: number
}

const quickActions = [
  {
    label: 'Manage Users',
    description: 'Invite, view, and manage organization members',
    href: '/admin/users',
    icon: Users,
  },
  {
    label: 'View Roles',
    description: 'Create and manage roles and permissions',
    href: '/admin/roles',
    icon: Shield,
  },
  {
    label: 'Audit Logs',
    description: 'Review organization activity and events',
    href: '/admin/audit',
    icon: ScrollText,
  },
  {
    label: 'Organization Settings',
    description: 'Configure organization name and domain',
    href: '/admin/settings',
    icon: Settings,
  },
]

function DashboardSkeleton() {
  return (
    <div className='space-y-6'>
      <div>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='mt-2 h-4 w-96' />
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className='h-4 w-24' />
              <Skeleton className='h-3 w-32' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-8 w-16' />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className='h-5 w-28' />
              <Skeleton className='h-3 w-48' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-4 w-36' />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [data, setData] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchMe() {
      try {
        setLoading(true)
        setError(null)
        const res = await apiFetch<{ success: boolean; data: { user: { id: string; email: string; name: string }; currentTenant: { id: string; name: string; slug: string; status: string; role: string } | null; permissions: unknown[] } }>('/api/v1/auth/me')
        const { user, currentTenant, permissions } = res.data
        const me: MeResponse = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: currentTenant?.role ?? '',
          tenantId: currentTenant?.id ?? '',
          tenantName: currentTenant?.name ?? '',
          tenantPlan: '',
          memberCount: 0,
          permissionsCount: permissions.length,
        }
        if (!cancelled) {
          setData(me)
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to load organization info'
          setError(message)
          toast.error(message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchMe()
    return () => {
      cancelled = true
    }
  }, [])

  const firstName = data?.name?.split(' ')[0] || 'Admin'

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>
          {loading ? (
            <Skeleton className='inline-block h-8 w-64' />
          ) : (
            <>
              Welcome back{data ? `, ${firstName}` : ''}
            </>
          )}
        </h1>
        {!loading && data && (
          <p className='text-muted-foreground mt-1'>
            Organization overview for {data.tenantName}
          </p>
        )}
      </div>

      {loading && <DashboardSkeleton />}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 text-destructive shrink-0' />
            <p className='text-sm text-destructive'>{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && !data && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Building2 className='size-10 text-muted-foreground/50 mb-3' />
            <p className='text-sm font-medium text-muted-foreground'>
              Organization data unavailable
            </p>
            <p className='text-xs text-muted-foreground mt-1'>
              Unable to load your organization information. Please try again later.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && data && (
        <>
          {/* Info Cards */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Building2 className='size-4 text-muted-foreground' />
                  <CardTitle className='text-sm font-medium'>Organization</CardTitle>
                </div>
                <CardDescription>Your workspace name</CardDescription>
              </CardHeader>
              <CardContent>
                <p className='text-lg font-semibold truncate'>{data.tenantName}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Crown className='size-4 text-muted-foreground' />
                  <CardTitle className='text-sm font-medium'>Plan</CardTitle>
                </div>
                <CardDescription>Current subscription tier</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant='secondary'>{data.tenantPlan || 'FREE'}</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Users className='size-4 text-muted-foreground' />
                  <CardTitle className='text-sm font-medium'>Members</CardTitle>
                </div>
                <CardDescription>People in this organization</CardDescription>
              </CardHeader>
              <CardContent>
                <p className='text-lg font-semibold'>{data.memberCount}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Shield className='size-4 text-muted-foreground' />
                  <CardTitle className='text-sm font-medium'>Your Role</CardTitle>
                </div>
                <CardDescription>
                  {data.permissionsCount} permissions assigned
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant='default'>{data.role}</Badge>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className='text-lg font-semibold mb-4'>Quick Actions</h2>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <Link key={action.href} href={action.href} className='group'>
                    <Card className='transition-colors hover:bg-accent/50 h-full'>
                      <CardHeader>
                        <div className='flex items-center gap-3'>
                          <div className='flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors'>
                            <Icon className='size-5' />
                          </div>
                          <CardTitle className='text-sm font-medium'>
                            {action.label}
                          </CardTitle>
                        </div>
                        <CardDescription>{action.description}</CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
