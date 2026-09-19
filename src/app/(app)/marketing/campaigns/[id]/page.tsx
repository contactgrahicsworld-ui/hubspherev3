'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, Megaphone, Calendar, User, Mail, Eye, MousePointerClick, Send,
  AlertTriangle, Play, Pause,
} from 'lucide-react'

interface Campaign {
  id: string; name: string; type: string; status: string
  audience: any; content: any; schedule: any; metrics: any
  startDate: string | null; endDate: string | null; createdAt: string; updatedAt: string
  creator: { id: string; name: string | null; email: string | null } | null
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RUNNING: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PAUSED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  COMPLETED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
}

const TYPE_LABELS: Record<string, string> = { EMAIL: 'Email', SMS: 'SMS', WHATSAPP: 'WhatsApp', MULTI_CHANNEL: 'Multi-Channel' }

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '-' }
}

export default function CampaignDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchCampaign = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await apiFetch<{ success: boolean; data: Campaign }>(`/api/v1/marketing/campaigns/${id}`)
      setCampaign(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load campaign'
      setError(message); toast.error(message)
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { fetchCampaign() }, [fetchCampaign])

  const handleAction = async (action: 'launch' | 'pause') => {
    try {
      setActionLoading(true)
      await apiFetch<{ success: boolean }>(`/api/v1/marketing/campaigns/${id}/${action}`, { method: 'POST' })
      toast.success(`Campaign ${action === 'launch' ? 'launched' : 'paused'} successfully`)
      fetchCampaign()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} campaign`)
    } finally { setActionLoading(false) }
  }

  if (loading) {
    return <div className='space-y-6'><Skeleton className='h-8 w-40' /><div className='grid grid-cols-1 gap-6 lg:grid-cols-2'><Skeleton className='h-64' /><Skeleton className='h-64' /></div></div>
  }

  if (error || !campaign) {
    return (
      <div className='space-y-6'>
        <Button variant='ghost' onClick={() => router.push('/marketing/campaigns')}><ArrowLeft className='mr-2 size-4' />Back</Button>
        <Card className='border-destructive/50'><CardContent className='flex items-center justify-center py-12'><AlertTriangle className='mr-3 size-5 text-destructive' /><p className='text-sm text-destructive'>{error || 'Campaign not found'}</p></CardContent></Card>
      </div>
    )
  }

  const metrics = campaign.metrics as Record<string, number> | null
  const m = metrics ?? { sent: 0, delivered: 0, opened: 0, clicked: 0 }
  const deliveryRate = m.sent > 0 ? ((m.delivered / m.sent) * 100).toFixed(1) : '0'
  const openRate = m.delivered > 0 ? ((m.opened / m.delivered) * 100).toFixed(1) : '0'
  const clickRate = m.delivered > 0 ? ((m.clicked / m.delivered) * 100).toFixed(1) : '0'

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='sm' onClick={() => router.push('/marketing/campaigns')}><ArrowLeft className='mr-2 size-4' />Back</Button>
        <div className='flex-1'>
          <h1 className='text-2xl font-bold tracking-tight'>{campaign.name}</h1>
          <p className='text-muted-foreground mt-1'>{TYPE_LABELS[campaign.type] || campaign.type} Campaign</p>
        </div>
        <Badge variant='outline' className={STATUS_BADGE[campaign.status] || ''}>{campaign.status}</Badge>
        {campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED' || campaign.status === 'PAUSED' ? (
          <Button size='sm' onClick={() => handleAction('launch')} disabled={actionLoading}><Play className='mr-2 size-4' />Launch</Button>
        ) : null}
        {campaign.status === 'RUNNING' ? (
          <Button size='sm' variant='outline' onClick={() => handleAction('pause')} disabled={actionLoading}><Pause className='mr-2 size-4' />Pause</Button>
        ) : null}
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        {/* Campaign Details */}
        <Card className='lg:col-span-2'>
          <CardHeader><CardTitle className='text-base'>Campaign Details</CardTitle></CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <p className='text-xs text-muted-foreground'>Type</p>
                <p className='mt-1 text-sm font-medium'>{TYPE_LABELS[campaign.type]}</p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Status</p>
                <p className='mt-1'><Badge variant='outline' className={STATUS_BADGE[campaign.status] || ''}>{campaign.status}</Badge></p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Start Date</p>
                <p className='mt-1 flex items-center gap-1.5 text-sm font-medium'><Calendar className='size-3.5' />{formatDate(campaign.startDate)}</p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>End Date</p>
                <p className='mt-1 text-sm font-medium'>{formatDate(campaign.endDate)}</p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Created By</p>
                <p className='mt-1 flex items-center gap-1.5 text-sm font-medium'><User className='size-3.5' />{campaign.creator?.name || '-'}</p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Created</p>
                <p className='mt-1 text-sm font-medium'>{formatDate(campaign.createdAt)}</p>
              </div>
            </div>
            {campaign.content && (
              <>
                <Separator />
                <div>
                  <p className='text-xs text-muted-foreground'>Content Configuration</p>
                  <pre className='mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs'>{JSON.stringify(campaign.content, null, 2)}</pre>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader><CardTitle className='text-base'>Performance</CardTitle></CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-center gap-3'>
              <div className='flex size-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'><Send className='size-4' /></div>
              <div><p className='text-xs text-muted-foreground'>Sent</p><p className='font-semibold'>{m.sent?.toLocaleString() ?? 0}</p></div>
            </div>
            <div className='flex items-center gap-3'>
              <div className='flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'><Mail className='size-4' /></div>
              <div><p className='text-xs text-muted-foreground'>Delivered ({deliveryRate}%)</p><p className='font-semibold'>{m.delivered?.toLocaleString() ?? 0}</p></div>
            </div>
            <div className='flex items-center gap-3'>
              <div className='flex size-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'><Eye className='size-4' /></div>
              <div><p className='text-xs text-muted-foreground'>Opened ({openRate}%)</p><p className='font-semibold'>{m.opened?.toLocaleString() ?? 0}</p></div>
            </div>
            <div className='flex items-center gap-3'>
              <div className='flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'><MousePointerClick className='size-4' /></div>
              <div><p className='text-xs text-muted-foreground'>Clicked ({clickRate}%)</p><p className='font-semibold'>{m.clicked?.toLocaleString() ?? 0}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
