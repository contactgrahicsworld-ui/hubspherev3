'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Megaphone, Mail, FileText, Users, Send, Eye, MousePointerClick, AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'

interface DashboardData {
  totalCampaigns: number
  activeCampaigns: number
  totalForms: number
  totalSubmissions: number
  totalLists: number
  aggregateMetrics: { totalSent: number; totalDelivered: number; totalOpened: number; totalClicked: number }
  recentCampaigns: Array<{
    id: string; name: string; type: string; status: string; updatedAt: string
    creator: { id: string; name: string | null } | null
  }>
  recentSubmissions: Array<{
    id: string; source: string | null; createdAt: string
    form: { id: string; name: string }
  }>
}

function formatDate(dateStr: string) {
  try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '-' }
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RUNNING: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PAUSED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  COMPLETED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
}

export default function MarketingDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await apiFetch<{ success: boolean; data: DashboardData }>('/api/v1/marketing/dashboard')
      setData(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard'
      setError(message); toast.error(message)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  if (loading) {
    return (
      <div className='space-y-6'>
        <div><Skeleton className='h-8 w-48' /><Skeleton className='mt-1 h-4 w-64' /></div>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className='h-24' />)}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className='space-y-6'>
        <h1 className='text-2xl font-bold tracking-tight'>Marketing Dashboard</h1>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertTriangle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>{error || 'Failed to load'}</p>
            <button onClick={fetchDashboard} className='mt-2 text-sm text-primary underline-offset-4 hover:underline'>Try again</button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const m = data.aggregateMetrics
  const deliveryRate = m.totalSent > 0 ? ((m.totalDelivered / m.totalSent) * 100).toFixed(1) : '0'
  const openRate = m.totalDelivered > 0 ? ((m.totalOpened / m.totalDelivered) * 100).toFixed(1) : '0'
  const clickRate = m.totalDelivered > 0 ? ((m.totalClicked / m.totalDelivered) * 100).toFixed(1) : '0'

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Marketing Dashboard</h1>
        <p className='text-muted-foreground mt-1'>Campaign performance, form submissions, and audience growth</p>
      </div>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'>
                <Megaphone className='size-4' />
              </div>
              <div><p className='text-xs text-muted-foreground'>Active Campaigns</p><p className='text-xl font-semibold'>{data.activeCampaigns}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'>
                <Send className='size-4' />
              </div>
              <div><p className='text-xs text-muted-foreground'>Total Sent</p><p className='text-xl font-semibold'>{m.totalSent.toLocaleString()}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'>
                <Eye className='size-4' />
              </div>
              <div><p className='text-xs text-muted-foreground'>Open Rate</p><p className='text-xl font-semibold'>{openRate}%</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'>
                <MousePointerClick className='size-4' />
              </div>
              <div><p className='text-xs text-muted-foreground'>Click Rate</p><p className='text-xl font-semibold'>{clickRate}%</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Recent Campaigns */}
        <Card>
          <CardHeader className='pb-2'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Megaphone className='size-4 text-muted-foreground' />
                <CardTitle className='text-base'>Recent Campaigns</CardTitle>
              </div>
              <Link href='/marketing/campaigns'><Button variant='ghost' size='sm' className='text-xs'>View all</Button></Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentCampaigns.length > 0 ? (
              <div className='space-y-3'>
                {data.recentCampaigns.map((c) => (
                  <div key={c.id} className='flex items-center justify-between rounded-lg border p-3'>
                    <div>
                      <p className='text-sm font-medium'>{c.name}</p>
                      <p className='text-xs text-muted-foreground'>{c.type} · {formatDate(c.updatedAt)}</p>
                    </div>
                    <Badge variant='outline' className={STATUS_BADGE[c.status] || ''}>{c.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className='py-8 text-center text-sm text-muted-foreground'>No campaigns yet</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Submissions */}
        <Card>
          <CardHeader className='pb-2'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <FileText className='size-4 text-muted-foreground' />
                <CardTitle className='text-base'>Recent Submissions</CardTitle>
              </div>
              <Badge variant='outline' className='text-xs'>{data.totalSubmissions}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentSubmissions.length > 0 ? (
              <div className='space-y-3'>
                {data.recentSubmissions.map((s) => (
                  <div key={s.id} className='flex items-center justify-between rounded-lg border p-3'>
                    <div>
                      <p className='text-sm font-medium'>{s.form.name}</p>
                      <p className='text-xs text-muted-foreground'>{s.source || 'Direct'}</p>
                    </div>
                    <p className='text-xs text-muted-foreground'>{formatDate(s.createdAt)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className='py-8 text-center text-sm text-muted-foreground'>No submissions yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className='pb-2'><CardTitle className='text-base'>Quick Actions</CardTitle></CardHeader>
        <CardContent>
          <div className='flex flex-wrap gap-3'>
            <Link href='/marketing/campaigns'><Button variant='outline' size='sm'><Megaphone className='mr-2 size-4' />Campaigns</Button></Link>
            <Link href='/marketing/forms'><Button variant='outline' size='sm'><FileText className='mr-2 size-4' />Lead Forms ({data.totalForms})</Button></Link>
            <Link href='/marketing/lists'><Button variant='outline' size='sm'><Users className='mr-2 size-4' />Lists ({data.totalLists})</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
