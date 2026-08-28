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
import { CompanyFormDialog } from '@/components/crm/company-form'
import {
  ArrowLeft, Pencil, Mail, Phone, Globe, MapPin, UserCheck, StickyNote, Activity, Clock, AlertCircle, Loader2, Send, Users, DollarSign, Building2, User, Briefcase,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DEAL_STAGES } from '@/lib/constants'

// ============================================
// Types
// ============================================

interface CompanyOwner {
  id: string
  name: string | null
  email: string | null
}

interface Company {
  id: string
  name: string
  industry: string | null
  website: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  ownerId: string | null
  owner: CompanyOwner | null
  notes: string | null
  archived: boolean
  contactCount: number
  dealCount: number
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

interface ContactItem {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
  mobile: string | null
  title: string | null
  createdAt: string
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
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch { return '-' }
}

function formatCurrency(val: number, currency?: string): string {
  if (val == null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency || 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0,
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

// ============================================
// Main Page
// ============================================

export default function CompanyDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [contacts, setContacts] = useState<ContactItem[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [activeTab, setActiveTab] = useState('details')

  const [noteContent, setNoteContent] = useState('')
  const [noteSubmitting, setNoteSubmitting] = useState(false)

  const fetchCompany = useCallback(async () => {
    try {
      const res = await apiFetch<{ success: boolean; data: Company }>(
        `/api/v1/crm/companies/${id}`
      )
      setCompany(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load company'
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
            `/api/v1/crm/timeline?entityType=COMPANY&entityId=${id}&limit=50`
          )
          setTimeline(res.data ?? [])
          setNotes((res.data ?? []).filter((i) => i.type === 'NOTE').map((i) => ({
            id: i.id, content: i.description ?? '', user: i.user, createdAt: i.createdAt,
          })))
        } catch { /* silent */ }
      }
    }
    if (tab === 'contacts') {
      try {
        const res = await apiFetch<{ success: boolean; data: ContactItem[] }>(
          `/api/v1/crm/contacts?companyId=${id}&limit=50`
        )
        setContacts(res.data ?? [])
      } catch { /* silent */ }
    }
    if (tab === 'deals') {
      try {
        const res = await apiFetch<{ success: boolean; data: Deal[] }>(
          `/api/v1/crm/deals?companyId=${id}&limit=50`
        )
        setDeals(res.data ?? [])
      } catch { /* silent */ }
    }
  }, [id, timeline.length])

  useEffect(() => { fetchCompany() }, [fetchCompany])
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
        body: JSON.stringify({ content: noteContent.trim(), entityType: 'COMPANY', entityId: id }),
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

  if (loading) {
    return (
      <div className='space-y-6'>
        <Skeleton className='h-8 w-32' />
        <div className='grid gap-6 md:grid-cols-3'>
          <div className='md:col-span-2 space-y-4'>
            <Skeleton className='h-10 w-64' />
            <Skeleton className='h-32' />
            <Skeleton className='h-64' />
          </div>
          <div className='space-y-4'><Skeleton className='h-64' /></div>
        </div>
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className='space-y-6'>
        <Button variant='ghost' size='sm' onClick={() => router.push('/crm/companies')}>
          <ArrowLeft className='size-4' /> Back to Companies
        </Button>
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-12'>
            <AlertCircle className='size-5 shrink-0 text-destructive' />
            <p className='text-sm text-destructive'>{error || 'Company not found'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const location = [company.city, company.state, company.country].filter(Boolean).join(', ')

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <Button variant='ghost' size='sm' onClick={() => router.push('/crm/companies')}>
          <ArrowLeft className='size-4' /> Back to Companies
        </Button>
        <Button size='sm' onClick={() => setEditOpen(true)}>
          <Pencil className='size-4' /> Edit Company
        </Button>
      </div>

      <div>
        <div className='flex items-center gap-3'>
          <div className='flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <Building2 className='size-5' />
          </div>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{company.name}</h1>
            {company.industry && <p className='text-sm text-muted-foreground'>{company.industry}</p>}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='w-full justify-start overflow-x-auto'>
          <TabsTrigger value='details'>Details</TabsTrigger>
          <TabsTrigger value='contacts'>Contacts</TabsTrigger>
          <TabsTrigger value='deals'>Deals</TabsTrigger>
          <TabsTrigger value='notes'>Notes</TabsTrigger>
          <TabsTrigger value='activities'>Activities</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value='details' className='mt-6'>
          <div className='grid gap-6 md:grid-cols-3'>
            <Card className='md:col-span-2'>
              <CardHeader><CardTitle className='text-base'>Company Information</CardTitle></CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-4 sm:grid-cols-2'>
                  <div className='flex items-start gap-3'>
                    <Building2 className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                    <div><p className='text-xs text-muted-foreground'>Name</p><p className='text-sm font-medium'>{company.name}</p></div>
                  </div>
                  <div className='flex items-start gap-3'>
                    <Briefcase className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                    <div><p className='text-xs text-muted-foreground'>Industry</p><p className='text-sm font-medium'>{company.industry || '-'}</p></div>
                  </div>
                  <div className='flex items-start gap-3'>
                    <Mail className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                    <div><p className='text-xs text-muted-foreground'>Email</p><p className='text-sm font-medium'>{company.email || '-'}</p></div>
                  </div>
                  <div className='flex items-start gap-3'>
                    <Phone className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                    <div><p className='text-xs text-muted-foreground'>Phone</p><p className='text-sm font-medium'>{company.phone || '-'}</p></div>
                  </div>
                  <div className='flex items-start gap-3'>
                    <Globe className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                    <div><p className='text-xs text-muted-foreground'>Website</p>
                      {company.website ? (
                        <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                          target='_blank' rel='noopener noreferrer' className='text-sm font-medium text-primary hover:underline'>
                          {company.website}
                        </a>
                      ) : <p className='text-sm font-medium'>-</p>}
                    </div>
                  </div>
                  <div className='flex items-start gap-3'>
                    <MapPin className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                    <div><p className='text-xs text-muted-foreground'>Location</p><p className='text-sm font-medium'>{location || '-'}</p></div>
                  </div>
                </div>
                {company.address && (
                  <>
                    <Separator />
                    <div><p className='mb-1 text-xs text-muted-foreground'>Address</p><p className='whitespace-pre-wrap text-sm'>{company.address}</p></div>
                  </>
                )}
                {company.notes && (
                  <>
                    <Separator />
                    <div><p className='mb-1 text-xs text-muted-foreground'>Notes</p><p className='whitespace-pre-wrap text-sm'>{company.notes}</p></div>
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
                      <p className='text-sm font-medium'>{company.owner?.name || 'Unassigned'}</p>
                      {company.owner?.email && <p className='text-xs text-muted-foreground'>{company.owner.email}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className='text-base'>Stats</CardTitle></CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex items-center gap-3 text-sm'>
                    <Users className='size-4 text-muted-foreground' />
                    <div><p className='text-xs text-muted-foreground'>Contacts</p><p className='font-medium'>{company.contactCount}</p></div>
                  </div>
                  <div className='flex items-center gap-3 text-sm'>
                    <DollarSign className='size-4 text-muted-foreground' />
                    <div><p className='text-xs text-muted-foreground'>Deals</p><p className='font-medium'>{company.dealCount}</p></div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className='text-base'>Timestamps</CardTitle></CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex items-center gap-2 text-sm'>
                    <Clock className='size-4 text-muted-foreground' />
                    <div><p className='text-xs text-muted-foreground'>Created</p><p className='font-medium'>{formatDateTime(company.createdAt)}</p></div>
                  </div>
                  <div className='flex items-center gap-2 text-sm'>
                    <Activity className='size-4 text-muted-foreground' />
                    <div><p className='text-xs text-muted-foreground'>Updated</p><p className='font-medium'>{formatDateTime(company.updatedAt)}</p></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value='contacts' className='mt-6'>
          <Card>
            <CardHeader><CardTitle className='text-base'>Contacts ({contacts.length})</CardTitle></CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <div className='flex flex-col items-center py-8 text-center'>
                  <Users className='mb-2 size-8 text-muted-foreground/50' />
                  <p className='text-sm text-muted-foreground'>No contacts in this company</p>
                </div>
              ) : (
                <div className='max-h-96 space-y-3 overflow-y-auto'>
                  {contacts.map((c) => (
                    <div
                      key={c.id}
                      className='flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 transition-shadow hover:shadow-sm'
                      onClick={() => router.push(`/crm/contacts/${c.id}`)}
                    >
                      <div className='min-w-0 flex-1'>
                        <p className='text-sm font-medium'>{[c.firstName, c.lastName].filter(Boolean).join(' ')}</p>
                        <div className='mt-0.5 flex items-center gap-2 text-xs text-muted-foreground'>
                          {c.email && <span>{c.email}</span>}
                          {c.mobile && <span>{c.mobile}</span>}
                        </div>
                      </div>
                      {c.title && <Badge variant='outline' className='shrink-0'>{c.title}</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deals Tab */}
        <TabsContent value='deals' className='mt-6'>
          <Card>
            <CardHeader><CardTitle className='text-base'>Deals ({deals.length})</CardTitle></CardHeader>
            <CardContent>
              {deals.length === 0 ? (
                <div className='flex flex-col items-center py-8 text-center'>
                  <DollarSign className='mb-2 size-8 text-muted-foreground/50' />
                  <p className='text-sm text-muted-foreground'>No deals for this company</p>
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
                      <Badge variant='outline' className={`shrink-0 ${STAGE_BADGE_STYLES[deal.stage] || ''}`}>
                        {deal.stage}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
                        item.type === 'NOTE'
                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
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
      </Tabs>

      <CompanyFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        company={company}
        onSuccess={() => { setEditOpen(false); fetchCompany() }}
      />
    </div>
  )
}
