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
import { LeadFormDialog } from '@/components/crm/lead-form'
import {
  ArrowLeft,
  Pencil,
  UserCheck,
  Mail,
  Phone,
  Building,
  DollarSign,
  Calendar,
  Tag,
  StickyNote,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  User,
  Send,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface LeadOwner {
  id: string
  name: string | null
  email: string | null
}

interface Lead {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
  mobile: string | null
  company: string | null
  source: string | null
  status: string | null
  priority: string | null
  ownerId: string | null
  owner: LeadOwner | null
  value: number | null
  description: string | null
  convertedToContactId: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
  tags: Array<{ id: string; name: string; color: string | null }>
}

interface Note {
  id: string
  content: string
  userId: string
  user: { id: string; name: string | null; email: string | null }
  createdAt: string
  updatedAt: string
}

interface TimelineItem {
  id: string
  type: 'ACTIVITY' | 'NOTE'
  activityType: string
  title: string
  description: string | null
  metadata: Record<string, unknown> | null
  user: { id: string; name: string | null; email: string | null }
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
  owner: { id: string; name: string | null; email: string | null }
}

// ============================================
// Badge Styles (same as list page)
// ============================================

const STATUS_BADGE_STYLES: Record<string, string> = {
  NEW: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  CONTACTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  QUALIFIED: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  PROPOSAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  NEGOTIATION: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  WON: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  LOST: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CONVERTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const PRIORITY_BADGE_STYLES: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: 'Website',
  REFERRAL: 'Referral',
  LINKEDIN: 'LinkedIn',
  COLD_CALL: 'Cold Call',
  EMAIL_CAMPAIGN: 'Email Campaign',
  ADVERTISEMENT: 'Advertisement',
  TRADE_SHOW: 'Trade Show',
  SOCIAL_MEDIA: 'Social Media',
  OTHER: 'Other',
}

const FOLLOWUP_STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  PENDING: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: <Clock className='size-3' />,
  },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: <CheckCircle className='size-3' />,
  },
  MISSED: {
    label: 'Missed',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: <XCircle className='size-3' />,
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    icon: <XCircle className='size-3' />,
  },
}

// ============================================
// Helpers
// ============================================

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return '-'
  }
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
}

function formatCurrency(val: number | null): string {
  if (val == null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val)
}

function getLeadName(lead: Lead): string {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '-'
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return formatDate(dateStr)
}

function DetailRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className='flex items-start gap-3 py-2'>
      {icon && <div className='mt-0.5 text-muted-foreground'>{icon}</div>}
      <div className='min-w-0 flex-1'>
        <p className='text-xs text-muted-foreground'>{label}</p>
        <p className='text-sm font-medium'>{value || '-'}</p>
      </div>
    </div>
  )
}

// ============================================
// Sub-Components
// ============================================

function LoadingState() {
  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-3'>
        <Skeleton className='size-8 w-8 rounded-md' />
        <Skeleton className='h-7 w-48' />
      </div>
      <Card>
        <CardContent className='p-6'>
          <Skeleton className='mb-4 h-8 w-64' />
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className='flex gap-3 py-2'>
                <Skeleton className='size-4 w-4 rounded' />
                <div className='flex-1 space-y-1'>
                  <Skeleton className='h-3 w-20' />
                  <Skeleton className='h-4 w-32' />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// Main Page
// ============================================

export default function LeadDetailPage() {
  const router = useRouter()
  const params = useParams()
  const leadId = params.id as string

  // Lead data
  const [lead, setLead] = useState<Lead | null>(null)
  const [loadingLead, setLoadingLead] = useState(true)
  const [errorLead, setErrorLead] = useState<string | null>(null)

  // Notes
  const [notes, setNotes] = useState<Note[]>([])
  const [noteContent, setNoteContent] = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [loadingNotes, setLoadingNotes] = useState(true)

  // Timeline
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [loadingTimeline, setLoadingTimeline] = useState(true)

  // Follow-ups
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [loadingFollowUps, setLoadingFollowUps] = useState(true)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)

  // Converting
  const [converting, setConverting] = useState(false)

  // ---- Fetch lead ----
  const fetchLead = useCallback(async () => {
    try {
      setLoadingLead(true)
      setErrorLead(null)
      const res = await apiFetch<{ success: boolean; data: Lead }>(
        `/api/v1/crm/leads/${leadId}`
      )
      setLead(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load lead'
      setErrorLead(message)
      toast.error(message)
    } finally {
      setLoadingLead(false)
    }
  }, [leadId])

  // ---- Fetch notes ----
  const fetchNotes = useCallback(async () => {
    try {
      setLoadingNotes(true)
      const res = await apiFetch<{ success: boolean; data: Note[] }>(
        `/api/v1/crm/notes?entityType=LEAD&entityId=${leadId}&limit=50`
      )
      setNotes(res.data ?? [])
    } catch {
      // Silently fail for notes
    } finally {
      setLoadingNotes(false)
    }
  }, [leadId])

  // ---- Fetch timeline ----
  const fetchTimeline = useCallback(async () => {
    try {
      setLoadingTimeline(true)
      const res = await apiFetch<{ success: boolean; data: TimelineItem[] }>(
        `/api/v1/crm/timeline?entityType=LEAD&entityId=${leadId}&limit=50`
      )
      setTimeline(res.data ?? [])
    } catch {
      // Silently fail for timeline
    } finally {
      setLoadingTimeline(false)
    }
  }, [leadId])

  // ---- Fetch follow-ups ----
  const fetchFollowUps = useCallback(async () => {
    try {
      setLoadingFollowUps(true)
      const res = await apiFetch<{ success: boolean; data: FollowUp[] }>(
        `/api/v1/crm/follow-ups?leadId=${leadId}&limit=50`
      )
      setFollowUps(res.data ?? [])
    } catch {
      // Silently fail
    } finally {
      setLoadingFollowUps(false)
    }
  }, [leadId])

  useEffect(() => {
    fetchLead()
  }, [fetchLead])

  useEffect(() => {
    if (lead) {
      fetchNotes()
      fetchTimeline()
      fetchFollowUps()
    }
  }, [lead, fetchNotes, fetchTimeline, fetchFollowUps])

  // ---- Add Note ----
  const handleAddNote = async (e: FormEvent) => {
    e.preventDefault()
    if (!noteContent.trim()) return
    try {
      setSubmittingNote(true)
      await apiFetch('/api/v1/crm/notes', {
        method: 'POST',
        body: JSON.stringify({
          content: noteContent.trim(),
          entityType: 'LEAD',
          entityId: leadId,
        }),
      })
      setNoteContent('')
      toast.success('Note added')
      fetchNotes()
      fetchTimeline()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add note'
      toast.error(message)
    } finally {
      setSubmittingNote(false)
    }
  }

  // ---- Convert to Contact ----
  const handleConvert = async () => {
    if (!lead) return
    try {
      setConverting(true)
      await apiFetch(`/api/v1/crm/leads/${leadId}/convert`, {
        method: 'POST',
      })
      toast.success('Lead converted to contact successfully')
      fetchLead()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to convert lead'
      toast.error(message)
    } finally {
      setConverting(false)
    }
  }

  // ---- Loading State ----
  if (loadingLead) return <LoadingState />

  // ---- Error State ----
  if (errorLead || !lead) {
    return (
      <div className='space-y-4'>
        <Button variant='ghost' size='sm' onClick={() => router.push('/crm/leads')}>
          <ArrowLeft className='size-4' />
          Back to Leads
        </Button>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertCircle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>
              {errorLead || 'Lead not found'}
            </p>
            <Button variant='outline' size='sm' onClick={fetchLead}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isConverted = !!lead.convertedToContactId

  return (
    <div className='space-y-6'>
      {/* Back Button */}
      <Button
        variant='ghost'
        size='sm'
        onClick={() => router.push('/crm/leads')}
        className='-ml-2'
      >
        <ArrowLeft className='size-4' />
        Back to Leads
      </Button>

      {/* Lead Header */}
      <Card>
        <CardContent className='p-4 sm:p-6'>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-2'>
                <h1 className='text-xl font-bold sm:text-2xl'>{getLeadName(lead)}</h1>
                <Badge variant='outline' className={STATUS_BADGE_STYLES[lead.status ?? 'NEW'] || ''}>
                  {lead.status ?? 'NEW'}
                </Badge>
                <Badge variant='outline' className={PRIORITY_BADGE_STYLES[lead.priority ?? 'MEDIUM'] || ''}>
                  {lead.priority ?? 'MEDIUM'}
                </Badge>
                {isConverted && (
                  <Badge className='bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'>
                    Converted
                  </Badge>
                )}
              </div>
              {lead.company && (
                <p className='mt-1 text-sm text-muted-foreground'>{lead.company}</p>
              )}
            </div>
            <div className='flex shrink-0 gap-2'>
              <Button variant='outline' size='sm' onClick={() => setEditOpen(true)}>
                <Pencil className='size-4' />
                <span className='hidden sm:inline'>Edit</span>
              </Button>
              {!isConverted && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleConvert}
                  disabled={converting}
                >
                  {converting ? (
                    <Loader2 className='size-4 animate-spin' />
                  ) : (
                    <UserCheck className='size-4' />
                  )}
                  <span className='hidden sm:inline'>Convert to Contact</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue='details'>
        <TabsList className='w-full justify-start overflow-x-auto'>
          <TabsTrigger value='details' className='gap-1.5'>
            <User className='hidden size-3.5 sm:inline-block' />
            Details
          </TabsTrigger>
          <TabsTrigger value='notes' className='gap-1.5'>
            <StickyNote className='hidden size-3.5 sm:inline-block' />
            Notes
          </TabsTrigger>
          <TabsTrigger value='activities' className='gap-1.5'>
            <Activity className='hidden size-3.5 sm:inline-block' />
            Activities
          </TabsTrigger>
          <TabsTrigger value='followups' className='gap-1.5'>
            <Clock className='hidden size-3.5 sm:inline-block' />
            Follow-ups
          </TabsTrigger>
        </TabsList>

        {/* ======== Details Tab ======== */}
        <TabsContent value='details' className='mt-4'>
          <Card>
            <CardContent className='p-4 sm:p-6'>
              <div className='grid grid-cols-1 gap-0 sm:grid-cols-2'>
                <DetailRow label='First Name' value={lead.firstName} icon={<User className='size-4' />} />
                <DetailRow label='Last Name' value={lead.lastName} />
                <DetailRow label='Email' value={lead.email} icon={<Mail className='size-4' />} />
                <DetailRow label='Mobile' value={lead.mobile} icon={<Phone className='size-4' />} />
                <DetailRow label='Company' value={lead.company} icon={<Building className='size-4' />} />
                <DetailRow label='Source' value={SOURCE_LABELS[lead.source ?? ''] || lead.source} icon={<Tag className='size-4' />} />
                <DetailRow label='Status' value={
                  <Badge variant='outline' className={STATUS_BADGE_STYLES[lead.status ?? 'NEW'] || ''}>
                    {lead.status ?? 'NEW'}
                  </Badge>
                } />
                <DetailRow label='Priority' value={
                  <Badge variant='outline' className={PRIORITY_BADGE_STYLES[lead.priority ?? 'MEDIUM'] || ''}>
                    {lead.priority ?? 'MEDIUM'}
                  </Badge>
                } />
                <DetailRow label='Deal Value' value={formatCurrency(lead.value)} icon={<DollarSign className='size-4' />} />
                <DetailRow label='Owner' value={lead.owner?.name || lead.owner?.email || '-'} icon={<User className='size-4' />} />
                <DetailRow label='Created' value={formatDateTime(lead.createdAt)} icon={<Calendar className='size-4' />} />
                <DetailRow label='Last Updated' value={formatDateTime(lead.updatedAt)} icon={<Calendar className='size-4' />} />
              </div>

              {lead.description && (
                <>
                  <Separator className='my-4' />
                  <div>
                    <p className='mb-1 text-xs text-muted-foreground'>Description</p>
                    <p className='whitespace-pre-wrap text-sm'>{lead.description}</p>
                  </div>
                </>
              )}

              {lead.tags.length > 0 && (
                <>
                  <Separator className='my-4' />
                  <div>
                    <p className='mb-2 text-xs text-muted-foreground'>Tags</p>
                    <div className='flex flex-wrap gap-1.5'>
                      {lead.tags.map((tag) => (
                        <Badge key={tag.id} variant='secondary'>{tag.name}</Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======== Notes Tab ======== */}
        <TabsContent value='notes' className='mt-4'>
          <div className='space-y-4'>
            {/* Add Note Form */}
            <Card>
              <CardContent className='p-4 sm:p-6'>
                <form onSubmit={handleAddNote} className='space-y-3'>
                  <Textarea
                    placeholder='Add a note...'
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    rows={3}
                    aria-label='Note content'
                  />
                  <div className='flex justify-end'>
                    <Button
                      type='submit'
                      size='sm'
                      disabled={submittingNote || !noteContent.trim()}
                    >
                      {submittingNote ? (
                        <Loader2 className='size-4 animate-spin' />
                      ) : (
                        <Send className='size-4' />
                      )}
                      Add Note
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Notes List */}
            {loadingNotes ? (
              <Card>
                <CardContent className='space-y-4 p-6'>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className='space-y-2'>
                      <Skeleton className='h-4 w-32' />
                      <Skeleton className='h-4 w-full' />
                      <Skeleton className='h-4 w-3/4' />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : notes.length === 0 ? (
              <Card>
                <CardContent className='flex flex-col items-center justify-center py-10 text-center'>
                  <StickyNote className='mb-3 size-10 text-muted-foreground/40' />
                  <p className='text-sm font-medium text-muted-foreground'>No notes yet</p>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    Add the first note for this lead.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className='space-y-3'>
                {notes.map((note) => (
                  <Card key={note.id}>
                    <CardContent className='p-4'>
                      <div className='flex items-start justify-between gap-2'>
                        <p className='text-xs text-muted-foreground'>
                          {note.user?.name || note.user?.email || 'Unknown'}
                        </p>
                        <p className='shrink-0 text-xs text-muted-foreground'>
                          {timeAgo(note.createdAt)}
                        </p>
                      </div>
                      <p className='mt-2 whitespace-pre-wrap text-sm'>{note.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ======== Activities Tab ======== */}
        <TabsContent value='activities' className='mt-4'>
          {loadingTimeline ? (
            <Card>
              <CardContent className='space-y-4 p-6'>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className='flex gap-3'>
                    <Skeleton className='size-8 w-8 shrink-0 rounded-full' />
                    <div className='flex-1 space-y-1'>
                      <Skeleton className='h-4 w-48' />
                      <Skeleton className='h-3 w-32' />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : timeline.length === 0 ? (
            <Card>
              <CardContent className='flex flex-col items-center justify-center py-10 text-center'>
                <Activity className='mb-3 size-10 text-muted-foreground/40' />
                <p className='text-sm font-medium text-muted-foreground'>No activities yet</p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  Activities will appear here as this lead progresses.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className='relative space-y-0'>
              {timeline.map((item, idx) => (
                <div key={item.id} className='relative flex gap-4 pb-6 last:pb-0'>
                  {/* Timeline line */}
                  {idx < timeline.length - 1 && (
                    <div className='absolute bottom-0 left-[15px] top-8 w-px bg-border' />
                  )}

                  {/* Icon dot */}
                  <div className='flex size-8 shrink-0 items-center justify-center rounded-full border bg-background'>
                    {item.type === 'NOTE' ? (
                      <StickyNote className='size-3.5 text-muted-foreground' />
                    ) : (
                      <Activity className='size-3.5 text-muted-foreground' />
                    )}
                  </div>

                  {/* Content */}
                  <div className='min-w-0 flex-1 pt-0.5'>
                    <div className='flex flex-wrap items-center gap-x-2 gap-y-0.5'>
                      <p className='text-sm font-medium'>{item.title}</p>
                      {item.type === 'ACTIVITY' && (
                        <Badge variant='secondary' className='text-[10px]'>
                          {item.activityType}
                        </Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className='mt-0.5 text-sm text-muted-foreground line-clamp-2'>
                        {item.description}
                      </p>
                    )}
                    <div className='mt-1 flex items-center gap-2 text-xs text-muted-foreground'>
                      <span>{item.user?.name || item.user?.email || 'System'}</span>
                      <span>·</span>
                      <span>{timeAgo(item.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ======== Follow-ups Tab ======== */}
        <TabsContent value='followups' className='mt-4'>
          {loadingFollowUps ? (
            <Card>
              <CardContent className='space-y-4 p-6'>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className='space-y-2'>
                    <Skeleton className='h-5 w-48' />
                    <Skeleton className='h-4 w-32' />
                    <Skeleton className='h-3 w-64' />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : followUps.length === 0 ? (
            <Card>
              <CardContent className='flex flex-col items-center justify-center py-10 text-center'>
                <Clock className='mb-3 size-10 text-muted-foreground/40' />
                <p className='text-sm font-medium text-muted-foreground'>No follow-ups yet</p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  Schedule follow-ups to stay on top of this lead.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className='space-y-3'>
              {followUps.map((fu) => {
                const config = FOLLOWUP_STATUS_CONFIG[fu.status] || FOLLOWUP_STATUS_CONFIG.PENDING
                return (
                  <Card key={fu.id}>
                    <CardContent className='p-4'>
                      <div className='flex items-start justify-between gap-2'>
                        <div className='min-w-0 flex-1'>
                          <p className='font-medium'>{fu.title}</p>
                          {fu.description && (
                            <p className='mt-0.5 text-sm text-muted-foreground line-clamp-2'>
                              {fu.description}
                            </p>
                          )}
                          <div className='mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
                            <span className='flex items-center gap-1'>
                              <Calendar className='size-3' />
                              {formatDateTime(fu.followUpAt)}
                            </span>
                            {fu.owner?.name && (
                              <span className='flex items-center gap-1'>
                                <User className='size-3' />
                                {fu.owner.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant='outline' className={config.className}>
                          {config.icon}
                          {config.label}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <LeadFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        lead={lead}
        onSuccess={fetchLead}
      />
    </div>
  )
}
