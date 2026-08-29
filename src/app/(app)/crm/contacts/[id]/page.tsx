'use client'

import { useEffect, useState, useCallback, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ContactFormDialog } from '@/components/crm/contact-form'
import {
  ArrowLeft,
  Pencil,
  Mail,
  Phone,
  Building2,
  Briefcase,
  User,
  StickyNote,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Send,
  DollarSign,
  UserCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DEAL_STAGES } from '@/lib/constants'

// ============================================
// Types
// ============================================

interface ContactOwner {
  id: string
  name: string | null
  email: string | null
}

interface ContactCompany {
  id: string
  name: string
  industry: string | null
}

interface Contact {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
  mobile: string | null
  phone: string | null
  title: string | null
  companyId: string | null
  company: ContactCompany | null
  ownerId: string | null
  owner: ContactOwner | null
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

interface Deal {
  id: string
  title: string
  value: number
  currency: string
  stage: string
  probability: number | null
  owner: { id: string; name: string | null; email: string | null } | null
  createdAt: string
}

// ============================================
// Helpers
// ============================================

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  } catch { return '-' }
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  } catch { return '-' }
}

function formatCurrency(val: number, currency?: string): string {
  if (val == null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val)
}

const STAGE_BADGE_STYLES: Record<string, string> = {
  NEW: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  QUALIFIED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PROPOSAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  NEGOTIATION: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  WON: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  LOST: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const FOLLOWUP_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  MISSED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

// ============================================
// Main Page
// ============================================

export default function ContactDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  // Tab data
  const [notes, setNotes] = useState<Note[]>([])
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [activeTab, setActiveTab] = useState('details')

  // Note form
  const [noteContent, setNoteContent] = useState('')
  const [noteSubmitting, setNoteSubmitting] = useState(false)

  const fetchContact = useCallback(async () => {
    try {
      const res = await apiFetch<{ success: boolean; data: Contact }>(
        `/api/v1/crm/contacts/${id}`
      )
      setContact(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load contact'
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
          const res = await apiFetch<{
            success: boolean
            data: TimelineItem[]
          }>(`/api/v1/crm/timeline?entityType=CONTACT&entityId=${id}&limit=50`)
          setTimeline(res.data ?? [])
          setNotes((res.data ?? []).filter((i) => i.type === 'NOTE').map((i) => ({
            id: i.id, content: i.description ?? '', user: i.user, createdAt: i.createdAt,
          })))
        } catch { /* silent */ }
      }
    }
    if (tab === 'follow-ups') {
      try {
        const res = await apiFetch<{
          success: boolean
          data: FollowUp[]
        }>(`/api/v1/crm/follow-ups?contactId=${id}&limit=50`)
        // Server-side filtered for this contact
        setFollowUps(res.data ?? [])
      } catch { /* silent */ }
    }
    if (tab === 'deals') {
      try {
        const res = await apiFetch<{
          success: boolean
          data: Deal[]
        }>(`/api/v1/crm/deals?contactId=${id}&limit=50`)
        setDeals(res.data ?? [])
      } catch { /* silent */ }
    }
  }, [id, timeline.length])

  useEffect(() => {
    fetchContact()
  }, [fetchContact])

  useEffect(() => {
    if (activeTab !== 'details') {
      fetchTabData(activeTab)
    }
  }, [activeTab, fetchTabData])

  const handleAddNote = async (e: FormEvent) => {
    e.preventDefault()
    if (!noteContent.trim()) return
    try {
      setNoteSubmitting(true)
      await apiFetch('/api/v1/crm/notes', {
        method: 'POST',
        body: JSON.stringify({
          content: noteContent.trim(),
          entityType: 'CONTACT',
          entityId: id,
        }),
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

  const getContactName = () => {
    if (!contact) return ''
    return [contact.firstName, contact.lastName].filter(Boolean).join(' ')
  }

  // ============================================
  // Loading
  // ============================================

  if (loading) {
    return (
      <div className='space-y-6'>
        <Skeleton className='h-8 w-24' />
        <div className='grid gap-6 md:grid-cols-3'>
          <div className='md:col-span-2 space-y-4'>
            <Skeleton className='h-10 w-64' />
            <Skeleton className='h-32' />
            <Skeleton className='h-64' />
          </div>
          <div className='space-y-4'>
            <Skeleton className='h-64' />
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // Error
  // ============================================

  if (error || !contact) {
    return (
      <div className='space-y-6'>
        <Button variant='ghost' size='sm' onClick={() => router.push('/crm/contacts')}>
          <ArrowLeft className='size-4' /> Back to Contacts
        </Button>
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-12'>
            <AlertCircle className='size-5 shrink-0 text-destructive' />
            <p className='text-sm text-destructive'>{error || 'Contact not found'}</p>
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
        <Button variant='ghost' size='sm' onClick={() => router.push('/crm/contacts')}>
          <ArrowLeft className='size-4' /> Back to Contacts
        </Button>
        <Button size='sm' onClick={() => setEditOpen(true)}>
          <Pencil className='size-4' /> Edit Contact
        </Button>
      </div>

      {/* Header */}
      <div>
        <div className='flex items-center gap-3'>
          <div className='flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <User className='size-5' />
          </div>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{getContactName()}</h1>
            {contact.title && (
              <p className='text-sm text-muted-foreground'>{contact.title}</p>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='w-full justify-start overflow-x-auto'>
          <TabsTrigger value='details'>Details</TabsTrigger>
          <TabsTrigger value='notes'>Notes</TabsTrigger>
          <TabsTrigger value='activities'>Activities</TabsTrigger>
          <TabsTrigger value='follow-ups'>Follow-ups</TabsTrigger>
          <TabsTrigger value='deals'>Deals</TabsTrigger>
        </TabsList>

        {/* ============================================
            Details Tab
        ============================================ */}
        <TabsContent value='details' className='mt-6'>
          <div className='grid gap-6 md:grid-cols-3'>
            {/* Contact Info */}
            <Card className='md:col-span-2'>
              <CardHeader><CardTitle className='text-base'>Contact Information</CardTitle></CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-4 sm:grid-cols-2'>
                  <div className='flex items-start gap-3'>
                    <User className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                    <div>
                      <p className='text-xs text-muted-foreground'>Name</p>
                      <p className='text-sm font-medium'>{getContactName()}</p>
                    </div>
                  </div>
                  <div className='flex items-start gap-3'>
                    <Briefcase className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                    <div>
                      <p className='text-xs text-muted-foreground'>Title</p>
                      <p className='text-sm font-medium'>{contact.title || '-'}</p>
                    </div>
                  </div>
                  <div className='flex items-start gap-3'>
                    <Mail className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                    <div>
                      <p className='text-xs text-muted-foreground'>Email</p>
                      <p className='text-sm font-medium'>{contact.email || '-'}</p>
                    </div>
                  </div>
                  <div className='flex items-start gap-3'>
                    <Phone className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                    <div>
                      <p className='text-xs text-muted-foreground'>Mobile</p>
                      <p className='text-sm font-medium'>{contact.mobile || '-'}</p>
                    </div>
                  </div>
                  <div className='flex items-start gap-3'>
                    <Phone className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                    <div>
                      <p className='text-xs text-muted-foreground'>Phone</p>
                      <p className='text-sm font-medium'>{contact.phone || '-'}</p>
                    </div>
                  </div>
                  {contact.company && (
                    <div className='flex items-start gap-3'>
                      <Building2 className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                      <div>
                        <p className='text-xs text-muted-foreground'>Company</p>
                        <button
                          className='text-sm font-medium text-primary hover:underline'
                          onClick={() => router.push(`/crm/companies/${contact.company!.id}`)}
                        >
                          {contact.company.name}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {contact.notes && (
                  <>
                    <Separator />
                    <div>
                      <p className='mb-1 text-xs text-muted-foreground'>Notes</p>
                      <p className='whitespace-pre-wrap text-sm'>{contact.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Sidebar */}
            <div className='space-y-6'>
              {/* Owner */}
              <Card>
                <CardHeader><CardTitle className='text-base'>Owner</CardTitle></CardHeader>
                <CardContent>
                  <div className='flex items-center gap-3'>
                    <div className='flex size-8 items-center justify-center rounded-full bg-primary/10'>
                      <UserCheck className='size-4 text-primary' />
                    </div>
                    <div>
                      <p className='text-sm font-medium'>{contact.owner?.name || 'Unassigned'}</p>
                      {contact.owner?.email && (
                        <p className='text-xs text-muted-foreground'>{contact.owner.email}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Timestamps */}
              <Card>
                <CardHeader><CardTitle className='text-base'>Timestamps</CardTitle></CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex items-center gap-2 text-sm'>
                    <Clock className='size-4 text-muted-foreground' />
                    <div>
                      <p className='text-xs text-muted-foreground'>Created</p>
                      <p className='font-medium'>{formatDateTime(contact.createdAt)}</p>
                    </div>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <Activity className='size-4 text-muted-foreground' />
                    <div>
                      <p className='text-xs text-muted-foreground'>Updated</p>
                      <p className='font-medium'>{formatDateTime(contact.updatedAt)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ============================================
            Notes Tab
        ============================================ */}
        <TabsContent value='notes' className='mt-6'>
          <Card>
            <CardHeader><CardTitle className='text-base'>Notes</CardTitle></CardHeader>
            <CardContent className='space-y-4'>
              <form onSubmit={handleAddNote} className='flex gap-2'>
                <Textarea
                  placeholder='Add a note...'
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={2}
                  className='flex-1'
                />
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

        {/* ============================================
            Activities Tab
        ============================================ */}
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
                        {item.description && (
                          <p className='mt-0.5 text-xs text-muted-foreground'>{item.description}</p>
                        )}
                        {item.user && (
                          <p className='mt-0.5 text-xs text-muted-foreground'>by {item.user.name || item.user.email}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================
            Follow-ups Tab
        ============================================ */}
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
                        {fu.description && (
                          <p className='mt-0.5 text-xs text-muted-foreground'>{fu.description}</p>
                        )}
                        <p className='mt-1 text-xs text-muted-foreground'>
                          Due: {formatDateTime(fu.followUpAt)}
                        </p>
                      </div>
                      <Badge variant='outline' className={FOLLOWUP_STATUS_STYLES[fu.status] || ''}>
                        {fu.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================
            Deals Tab
        ============================================ */}
        <TabsContent value='deals' className='mt-6'>
          <Card>
            <CardHeader><CardTitle className='text-base'>Associated Deals</CardTitle></CardHeader>
            <CardContent>
              {deals.length === 0 ? (
                <div className='flex flex-col items-center py-8 text-center'>
                  <DollarSign className='mb-2 size-8 text-muted-foreground/50' />
                  <p className='text-sm text-muted-foreground'>No deals associated with this contact</p>
                </div>
              ) : (
                <div className='max-h-96 space-y-3 overflow-y-auto'>
                  {deals.map((deal) => (
                    <div
                      key={deal.id}
                      className='flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3 transition-shadow hover:shadow-sm'
                      onClick={() => router.push(`/crm/deals/${deal.id}`)}
                    >
                      <div className='min-w-0 flex-1'>
                        <p className='text-sm font-medium'>{deal.title}</p>
                        <p className='mt-0.5 text-xs text-muted-foreground'>
                          {formatCurrency(deal.value, deal.currency)}
                          {deal.probability != null && ` · ${deal.probability}%`}
                        </p>
                      </div>
                      <div className='flex shrink-0 flex-col items-end gap-1'>
                        <Badge variant='outline' className={STAGE_BADGE_STYLES[deal.stage] || ''}>
                          {deal.stage}
                        </Badge>
                        {deal.owner?.name && (
                          <span className='text-xs text-muted-foreground'>{deal.owner.name}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ContactFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        contact={contact}
        onSuccess={() => { setEditOpen(false); fetchContact() }}
      />
    </div>
  )
}
