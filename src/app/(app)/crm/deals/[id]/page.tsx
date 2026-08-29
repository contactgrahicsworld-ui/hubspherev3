'use client'

import { useEffect, useState, useCallback, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { DealFormDialog } from '@/components/crm/deal-form'
import {
  ArrowLeft,
  Pencil,
  User,
  Building2,
  DollarSign,
  CalendarDays,
  Percent,
  Clock,
  AlertCircle,
  StickyNote,
  Activity,
  Loader2,
  Send,
  ArrowRight,
  UserCheck,
  TrendingDown,
} from 'lucide-react'
import { DEAL_STAGES } from '@/lib/constants'

// ============================================
// Types
// ============================================

interface DealOwner {
  id: string
  name: string | null
  email: string | null
}

interface DealContact {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
}

interface DealCompany {
  id: string
  name: string
  industry: string | null
}

interface Deal {
  id: string
  title: string
  value: number
  currency: string | null
  stage: string
  probability: number | null
  expectedCloseDate: string | null
  contactId: string | null
  contact: DealContact | null
  companyId: string | null
  company: DealCompany | null
  ownerId: string | null
  owner: DealOwner | null
  lostReason: string | null
  notes: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

interface TimelineItem {
  id: string
  type: 'ACTIVITY' | 'NOTE'
  activityType: string
  title: string
  description: string | null
  user: { id: string; name: string | null; email: string | null } | null
  createdAt: string
  metadata?: Record<string, unknown> | null
}

interface Note {
  id: string
  content: string
  user: { id: string; name: string | null; email: string | null } | null
  createdAt: string
}

interface FollowUp {
  id: string
  title: string
  description: string | null
  status: string
  followUpAt: string
  completedAt: string | null
  createdAt: string
  owner: { id: string; name: string | null; email: string | null } | null
}

interface StageHistoryEntry {
 id: string
  dealId: string
  fromStage: string | null
  toStage: string
  movedBy: string | null
  createdAt: string
  // Joined from user
  user?: { id: string; name: string | null; email: string | null } | null
}

// ============================================
// Constants
// ============================================

const STAGE_BADGE_STYLES: Record<string, string> = {
  NEW: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  QUALIFIED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PROPOSAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  NEGOTIATION: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  WON: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  LOST: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const STAGE_COLORS: Record<string, string> = {
  NEW: 'text-indigo-600 dark:text-indigo-400',
  QUALIFIED: 'text-blue-600 dark:text-blue-400',
  PROPOSAL: 'text-amber-600 dark:text-amber-400',
  NEGOTIATION: 'text-orange-600 dark:text-orange-400',
  WON: 'text-green-600 dark:text-green-400',
  LOST: 'text-red-600 dark:text-red-400',
}

const FOLLOWUP_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  MISSED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

// ============================================
// Helpers
// ============================================

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return '-' }
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch { return '-' }
}

function formatCurrency(val: number, currency?: string | null): string {
  if (val == null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency || 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(val)
}

function getStageLabel(key: string): string {
 const stage = DEAL_STAGES.find(s => s.key === key)
  return stage?.label || key
}

// ============================================
// Main Page
// ============================================

export default function DealDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [stageHistory, setStageHistory] = useState<StageHistoryEntry[]>([])
  const [activeTab, setActiveTab] = useState('details')

  const [noteContent, setNoteContent] = useState('')
  const [noteSubmitting, setNoteSubmitting] = useState(false)

  const fetchDeal = useCallback(async () => {
    try {
      const res = await apiFetch<{ success: boolean; data: Deal }>(`/api/v1/crm/deals/${id}`)
      setDeal(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load deal'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchTabData = useCallback(async (tab: string) => {
    if (tab === 'notes' || tab === 'activities') {
      if (timeline.length === 0) {
        try {
          const res = await apiFetch<{ success: boolean; data: TimelineItem[] }>(
            `/api/v1/crm/timeline?entityType=DEAL&entityId=${id}&limit=50`
          )
          setTimeline(res.data ?? [])
          setNotes((res.data ?? []).filter((i) => i.type === 'NOTE').map((i) => ({
            id: i.id, content: i.description ?? '', user: i.user, createdAt: i.createdAt,
          })))
        } catch { /* silent */ }
      }
    }
    if (tab === 'follow-ups') {
      try {
        const res = await apiFetch<{ success: boolean; data: FollowUp[] }>('/api/v1/crm/follow-ups?limit=50')
        setFollowUps(res.data ?? [])
      } catch { /* silent */ }
    }
    if (tab === 'stage-history') {
      if (stageHistory.length === 0) {
        try {
          // Get stage history from timeline - filter DEAL_STAGE activities
          const res = await apiFetch<{ success: boolean; data: TimelineItem[] }>(
            `/api/v1/crm/timeline?entityType=DEAL&entityId=${id}&limit=50`
          )
          const stageActivities = (res.data ?? []).filter((i) => i.activityType === 'DEAL_STAGE')
          const entries: StageHistoryEntry[] = stageActivities.map((a) => ({
            id: a.id,
            dealId: id,
            fromStage: (a.metadata as Record<string, string>)?.fromStage ?? null,
            toStage: (a.metadata as Record<string, string>)?.toStage ?? a.title,
            movedBy: a.user?.id ?? null,
            createdAt: a.createdAt,
            user: a.user,
          }))
          setStageHistory(entries)
        } catch { /* silent */ }
      }
    }
  }, [id, timeline.length, stageHistory.length])

  useEffect(() => { fetchDeal() }, [fetchDeal])
  useEffect(() => {
    if (activeTab !== 'details') fetchTabData(activeTab)
  }, [activeTab, fetchTabData])

  const handleAddNote = async (e: FormEvent) => {
    e.preventDefault()
    if (!noteContent.trim()) return
    try {
      setNoteSubmitting(true)
      await apiFetch('/api/v1/crm/notes', {
        method: 'POST',
        body: JSON.stringify({ content: noteContent.trim(), entityType: 'DEAL', entityId: id }),
      })
      toast.success('Note added')
      setNoteContent('')
      setTimeline([])
      fetchTabData('notes')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add note')
    } finally {
      setNoteSubmitting(false)
    }
  }

  // ============================================
  // Loading
  // ============================================

  if (loading) {
    return (
      <div className='space-y-6'>
        <Skeleton className='h-8 w-24' />
        <div className='grid gap-6 md:grid-cols-3'>
          <div className='md:col-span-2 space-y-4'><Skeleton className='h-10 w-64' /><Skeleton className='h-32' /><Skeleton className='h-64' /></div>
          <div className='space-y-4'><Skeleton className='h-64' /></div>
        </div>
      </div>
    )
  }

  // ============================================
  // Error
  // ============================================

  if (error || !deal) {
    return (
      <div className='space-y-6'>
        <Button variant='ghost' size='sm' onClick={() => router.push('/crm/deals')}>
          <ArrowLeft className='size-4' /> Back to Deals
        </Button>
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-12'>
            <AlertCircle className='size-5 shrink-0 text-destructive' />
            <p className='text-sm text-destructive'>{error || 'Deal not found'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ============================================
  // Render
  // ============================================

  return (
    <div className='space-y-6'>
      {/* Back + Actions */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <Button variant='ghost' size='sm' onClick={() => router.push('/crm/deals')}>
          <ArrowLeft className='size-4' /> Back to Deals
        </Button>
        <Button size='sm' onClick={() => setEditOpen(true)}>
          <Pencil className='size-4' /> Edit Deal
        </Button>
      </div>

      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex items-center gap-4'>
          <div className='flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <DollarSign className='size-5' />
          </div>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{deal.title}</h1>
            <p className='text-sm text-muted-foreground'>Created {formatDate(deal.createdAt)}</p>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <Badge variant='outline' className={STAGE_BADGE_STYLES[deal.stage] || ''}>{getStageLabel(deal.stage)}</Badge>
          <span className='text-xl font-bold'>{formatCurrency(deal.value, deal.currency)}</span>
          {deal.probability != null && (
            <span className='flex items-center gap-1 text-sm text-muted-foreground'>
              <Percent className='size-4' />{deal.probability}%
            </span>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='w-full justify-start overflow-x-auto'>
          <TabsTrigger value='details'>Details</TabsTrigger>
          <TabsTrigger value='notes'>Notes</TabsTrigger>
          <TabsTrigger value='activities'>Activities</TabsTrigger>
          <TabsTrigger value='follow-ups'>Follow-ups</TabsTrigger>
          <TabsTrigger value='stage-history'>Stage History</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value='details' className='mt-6'>
          <div className='grid gap-6 md:grid-cols-3'>
            <Card className='md:col-span-2'>
              <CardHeader><CardTitle className='text-base'>Deal Information</CardTitle></CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-4 sm:grid-cols-2'>
                  <div className='flex items-start gap-3'>
                    <DollarSign className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                    <div><p className='text-xs text-muted-foreground'>Value</p><p className='text-sm font-medium'>{formatCurrency(deal.value, deal.currency)}</p></div>
                  </div>
                  <div className='flex items-start gap-3'>
                    <CalendarDays className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                    <div><p className='text-xs text-muted-foreground'>Expected Close</p><p className='text-sm font-medium'>{formatDate(deal.expectedCloseDate ?? '')}</p></div>
                  </div>
                  {deal.contact && (
                    <div className='flex items-start gap-3'>
                      <User className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                      <div>
                        <p className='text-xs text-muted-foreground'>Contact</p>
                        <button
                          className='text-sm font-medium text-primary hover:underline'
                          onClick={() => router.push(`/crm/contacts/${deal.contact!.id}`)}
                        >
                          {[deal.contact.firstName, deal.contact.lastName].filter(Boolean).join(' ')}
                        </button>
                        {deal.contact.email && <p className='text-xs text-muted-foreground'>{deal.contact.email}</p>}
                      </div>
                    </div>
                  )}
                  {deal.company && (
                    <div className='flex items-start gap-3'>
                      <Building2 className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                      <div>
                        <p className='text-xs text-muted-foreground'>Company</p>
                        <button
                          className='text-sm font-medium text-primary hover:underline'
                          onClick={() => router.push(`/crm/companies/${deal.company!.id}`)}
                        >
                          {deal.company.name}
                        </button>
                        {deal.company.industry && <p className='text-xs text-muted-foreground'>{deal.company.industry}</p>}
                      </div>
                    </div>
                  )}
                </div>
                {deal.stage === 'LOST' && deal.lostReason && (
                  <>
                    <Separator />
                    <div className='flex items-start gap-3'>
                      <TrendingDown className='mt-0.5 size-4 shrink-0 text-red-500' />
                      <div><p className='text-xs text-red-500'>Lost Reason</p><p className='text-sm'>{deal.lostReason}</p></div>
                    </div>
                  </>
                )}
                {deal.notes && (
                  <>
                    <Separator />
                    <div><p className='mb-1 text-xs text-muted-foreground'>Notes</p><p className='whitespace-pre-wrap text-sm'>{deal.notes}</p></div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className='space-y-6'>
              <Card>
                <CardHeader><CardTitle className='text-base'>Owner</CardTitle></CardHeader>
                <CardContent>
                  <div className='flex items-center gap-3'>
                    <div className='flex size-8 items-center justify-center rounded-full bg-primary/10'>
                      <UserCheck className='size-4 text-primary' />
                    </div>
                    <div>
                      <p className='text-sm font-medium'>{deal.owner?.name || 'Unassigned'}</p>
                      {deal.owner?.email && <p className='text-xs text-muted-foreground'>{deal.owner.email}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className='text-base'>Pipeline</CardTitle></CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex items-center gap-2 text-sm'>
                    <div className='size-2 rounded-full' style={{ backgroundColor: DEAL_STAGES.find(s => s.key === deal.stage)?.color }} />
                    <span className={`font-medium ${STAGE_COLORS[deal.stage] || ''}`}>{getStageLabel(deal.stage)}</span>
                  </div>
                  {deal.probability != null && (
                    <div className='text-sm'>
                      <span className='text-muted-foreground'>Win Probability: </span>
                      <span className='font-medium'>{deal.probability}%</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className='text-base'>Timestamps</CardTitle></CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex items-center gap-2 text-sm'>
                    <Clock className='size-4 text-muted-foreground' />
                    <div><p className='text-xs text-muted-foreground'>Created</p><p className='font-medium'>{formatDateTime(deal.createdAt)}</p></div>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <Activity className='size-4 text-muted-foreground' />
                    <div><p className='text-xs text-muted-foreground'>Updated</p><p className='font-medium'>{formatDateTime(deal.updatedAt)}</p></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value='notes' className='mt-6'>
          <Card>
            <CardHeader><CardTitle className='text-base'>Notes</CardTitle></CardHeader>
            <CardContent className='space-y-4'>
              <form onSubmit={handleAddNote} className='flex gap-2'>
                <Textarea placeholder='Add a note...' value={noteContent} onChange={(e) => setNoteContent(e.target.value)} rows={2} className='flex-1' />
                <Button type='submit' disabled={noteSubmitting || !noteContent.trim()} size='icon' className='shrink-0 self-end'>
                  {noteSubmitting ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
                </Button>
              </form>
              <Separator />
              {notes.length === 0 ? (
                <div className='flex flex-col items-center py-8 text-center'>
                  <StickyNote className='mb-2 size-8 text-muted-foreground/50' />
                  <p className='text-sm text-muted-foreground'>No notes yet</p>
                </div>
              ) : (
                <div className='max-h-96 space-y-4 overflow-y-auto'>
                  {notes.map((note) => (
                    <div key={note.id} className='rounded-lg border p-3'>
                      <div className='flex items-center justify-between gap-2'>
                        <span className='text-sm font-medium'>{note.user?.name || 'Unknown'}</span>
                        <span className='text-xs text-muted-foreground'>{formatDateTime(note.createdAt)}</span>
                      </div>
                      <p className='mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground'>{note.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value='activities' className='mt-6'>
          <Card>
            <CardHeader><CardTitle className='text-base'>Activities</CardTitle></CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className='flex flex-col items-center py-8 text-center'>
                  <Activity className='mb-2 size-8 text-muted-foreground/50' />
                  <p className='text-sm text-muted-foreground'>No activities yet</p>
                </div>
              ) : (
                <div className='max-h-96 space-y-4 overflow-y-auto'>
                  {timeline.map((item) => (
                    <div key={item.id} className='flex gap-3'>
                      <div className={`mt-1 flex size-6 shrink-0 items-center justify-center rounded-full ${
                        item.type === 'NOTE' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {item.type === 'NOTE' ? <StickyNote className='size-3' /> : <Activity className='size-3' />}
                      </div>
                      <div className='min-w-0 flex-1'>
                        <div className='flex items-center justify-between gap-2'>
                          <span className='text-sm font-medium'>{item.title}</span>
                          <span className='shrink-0 text-xs text-muted-foreground'>{formatDateTime(item.createdAt)}</span>
                        </div>
                        {item.description && <p className='mt-0.5 text-xs text-muted-foreground'>{item.description}</p>}
                        {item.user && <p className='mt-0.5 text-xs text-muted-foreground'>by {item.user.name || item.user.email}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Follow-ups Tab */}
        <TabsContent value='follow-ups' className='mt-6'>
          <Card>
            <CardHeader><CardTitle className='text-base'>Follow-ups</CardTitle></CardHeader>
            <CardContent>
              {followUps.length === 0 ? (
                <div className='flex flex-col items-center py-8 text-center'>
                  <Clock className='mb-2 size-8 text-muted-foreground/50' />
                  <p className='text-sm text-muted-foreground'>No follow-ups yet</p>
                </div>
              ) : (
                <div className='max-h-96 space-y-3 overflow-y-auto'>
                  {followUps.map((fu) => (
                    <div key={fu.id} className='flex items-start justify-between gap-3 rounded-lg border p-3'>
                      <div className='min-w-0 flex-1'>
                        <p className='text-sm font-medium'>{fu.title}</p>
                        {fu.description && <p className='mt-0.5 text-xs text-muted-foreground'>{fu.description}</p>}
                        <p className='mt-1 text-xs text-muted-foreground'>Due: {formatDateTime(fu.followUpAt)}</p>
                      </div>
                      <Badge variant='outline' className={FOLLOWUP_STATUS_STYLES[fu.status] || ''}>{fu.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stage History Tab */}
        <TabsContent value='stage-history' className='mt-6'>
          <Card>
            <CardHeader><CardTitle className='text-base'>Stage History</CardTitle></CardHeader>
            <CardContent>
              {stageHistory.length === 0 ? (
                <div className='flex flex-col items-center py-8 text-center'>
                  <Activity className='mb-2 size-8 text-muted-foreground/50' />
                  <p className='text-sm text-muted-foreground'>No stage transitions recorded</p>
                </div>
              ) : (
                <div className='max-h-96 space-y-3 overflow-y-auto'>
                  {stageHistory.map((entry) => (
                    <div key={entry.id} className='flex items-start gap-3 rounded-lg border p-3'>
                      <div className='mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted'>
                        <ArrowRight className='size-4 text-muted-foreground' />
                      </div>
                      <div className='min-w-0 flex-1'>
                        <div className='flex flex-wrap items-center gap-2'>
                          {entry.fromStage ? (
                            <Badge variant='outline' className={STAGE_BADGE_STYLES[entry.fromStage] || ''}>{getStageLabel(entry.fromStage)}</Badge>
                          ) : (
                            <Badge variant='outline' className='bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'>Created</Badge>
                          )}
                          <ArrowRight className='size-3 text-muted-foreground' />
                          <Badge variant='outline' className={STAGE_BADGE_STYLES[entry.toStage] || ''}>{getStageLabel(entry.toStage)}</Badge>
                        </div>
                        <div className='mt-1.5 flex items-center gap-2 text-xs text-muted-foreground'>
                          <span>{formatDateTime(entry.createdAt)}</span>
                          {entry.user && <span>by {entry.user.name || entry.user.email}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DealFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        deal={deal}
        onSuccess={() => { setEditOpen(false); fetchDeal() }}
      />
    </div>
  )
}
