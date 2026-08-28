'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, getAccessToken } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Phone,
  Search,
  AlertCircle,
  Users,
  Mail,
  Building,
  User,
  FileText,
  CalendarClock,
  ExternalLink,
  PhoneCall,
  PhoneOff,
  Clock,
  PhoneMissed,
  Info,
  Loader2,
  StickyNote,
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
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface CallRecord {
  id: string
  direction: string | null
  callStatus: string | null
  callType: string | null
  duration: number | null
  createdAt: string
  agentId: string | null
  agent: { id: string; name: string | null; email: string | null } | null
  recordingStatus: string | null
  notes: string | null
  contactInfo: string | null
}

interface UserOption {
  id: string
  name: string
  email: string
}

// ============================================
// Constants
// ============================================

const STATUS_BADGE_STYLES: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  CONTACTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  QUALIFIED: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  PROPOSAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  NEGOTIATION: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  WON: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  LOST: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CONVERTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const PRIORITY_BADGE_STYLES: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  MEDIUM: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const DISPOSITION_OPTIONS = [
  { value: 'CONNECTED', label: 'Connected' },
  { value: 'NOT_REACHED', label: 'Not Reached' },
  { value: 'LEFT_VOICEMAIL', label: 'Left Voicemail' },
  { value: 'CALLBACK_LATER', label: 'Callback Later' },
]

// ============================================
// Helpers
// ============================================

function getLeadName(lead: Lead): string {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '-'
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '-'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function decodeToken(token: string): { userId: string; email: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const payload = JSON.parse(atob(parts[1]))
    return {
      userId: payload.sub || payload.userId || payload.id || '',
      email: payload.email || '',
    }
  } catch {
    return null
  }
}

// ============================================
// Lead List Skeleton
// ============================================

function LeadListSkeleton() {
  return (
    <div className='space-y-2 p-3'>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className='flex items-center gap-3 rounded-lg p-2'>
          <Skeleton className='size-8 rounded-full' />
          <div className='flex-1 space-y-1.5'>
            <Skeleton className='h-4 w-3/4' />
            <Skeleton className='h-3 w-1/2' />
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================
// Main Page
// ============================================

export default function TelecallerConsole() {
  const router = useRouter()

  // Leads state
  const [leads, setLeads] = useState<Lead[]>([])
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [leadsError, setLeadsError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout>>()

  // Calls state
  const [leadCalls, setLeadCalls] = useState<CallRecord[]>([])
  const [loadingCalls, setLoadingCalls] = useState(false)

  // Call dialog state
  const [callDialogOpen, setCallDialogOpen] = useState(false)
  const [creatingCall, setCreatingCall] = useState(false)
  const [activeCall, setActiveCall] = useState<CallRecord | null>(null)
  const [disposition, setDisposition] = useState('')
  const [callNotes, setCallNotes] = useState('')
  const [endingCall, setEndingCall] = useState(false)

  // Note dialog state
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Follow-up dialog
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false)
  const [followUpTitle, setFollowUpTitle] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [savingFollowUp, setSavingFollowUp] = useState(false)

  // Recording config
  const [recordingAvailable, setRecordingAvailable] = useState(true)

  // Debounce search
  useEffect(() => {
    searchRef.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => {
      if (searchRef.current) clearTimeout(searchRef.current)
    }
  }, [search])

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    try {
      setLoadingLeads(true)
      setLeadsError(null)

      const params = new URLSearchParams({
        status: 'NEW,CONTACTED,QUALIFIED',
        limit: '50',
      })
      if (debouncedSearch) params.set('search', debouncedSearch)

      const data = await apiFetch<{ success: boolean; data: Lead[] }>(
        `/api/v1/crm/leads?${params}`
      )
      setLeads(data.data ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load leads'
      setLeadsError(message)
      toast.error(message)
    } finally {
      setLoadingLeads(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Fetch call history for selected lead
  const fetchLeadCalls = useCallback(async (lead: Lead) => {
    setLoadingCalls(true)
    try {
      const params = new URLSearchParams({ limit: '20' })
      if (lead.mobile) params.set('contactInfo', lead.mobile)
      if (lead.email) params.set('contactInfo', lead.email)

      const data = await apiFetch<{ success: boolean; data: CallRecord[]; pagination: { total: number } }>(
        `/api/v1/crm/calls?${params}`
      )
      setLeadCalls(data.data ?? [])
    } catch {
      setLeadCalls([])
    } finally {
      setLoadingCalls(false)
    }
  }, [])

  // When a lead is selected, fetch its call history
  useEffect(() => {
    if (selectedLead) {
      fetchLeadCalls(selectedLead)
    } else {
      setLeadCalls([])
    }
  }, [selectedLead, fetchLeadCalls])

  // Check recording provider
  useEffect(() => {
    apiFetch<{ success: boolean; configured: boolean }>(
      '/api/v1/crm/calls/recording-status'
    ).then((res) => {
      setRecordingAvailable(res.configured ?? false)
    }).catch(() => {
      setRecordingAvailable(false)
    })
  }, [])

  // Start call - creates a call record
  const handleStartCall = async () => {
    if (!selectedLead) return

    try {
      setCreatingCall(true)
      const token = getAccessToken()
      const decoded = decodeToken(token || '')

      const payload: Record<string, unknown> = {
        direction: 'OUTBOUND',
        callType: 'WEBRTC',
        contactInfo: selectedLead.mobile || selectedLead.email || '',
        leadId: selectedLead.id,
      }
      if (decoded?.userId) payload.agentId = decoded.userId

      const call = await apiFetch<CallRecord>('/api/v1/crm/calls', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setActiveCall(call)
      setDisposition('')
      setCallNotes('')
      setCallDialogOpen(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start call'
      toast.error(message)
    } finally {
      setCreatingCall(false)
    }
  }

  // End call with disposition
  const handleEndCall = async () => {
    if (!activeCall) return

    try {
      setEndingCall(true)

      await apiFetch(`/api/v1/crm/calls/${activeCall.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          callStatus: 'ENDED',
          disposition,
          notes: callNotes.trim() || undefined,
        }),
      })

      toast.success('Call ended successfully')
      setCallDialogOpen(false)
      setActiveCall(null)
      if (selectedLead) fetchLeadCalls(selectedLead)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to end call'
      toast.error(message)
    } finally {
      setEndingCall(false)
    }
  }

  // Save note
  const handleSaveNote = async () => {
    if (!selectedLead || !noteText.trim()) return

    try {
      setSavingNote(true)
      await apiFetch(`/api/v1/crm/leads/${selectedLead.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          notes: selectedLead.notes
            ? `${selectedLead.notes}\n\n${noteText.trim()}`
            : noteText.trim(),
        }),
      })
      toast.success('Note added')
      setNoteDialogOpen(false)
      setNoteText('')
      // Update local state
      setSelectedLead({
        ...selectedLead,
        notes: selectedLead.notes
          ? `${selectedLead.notes}\n\n${noteText.trim()}`
          : noteText.trim(),
      })
      fetchLeads()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save note'
      toast.error(message)
    } finally {
      setSavingNote(false)
    }
  }

  // Schedule follow-up
  const handleScheduleFollowUp = async () => {
    if (!selectedLead || !followUpTitle.trim() || !followUpDate) return

    try {
      setSavingFollowUp(true)
      await apiFetch('/api/v1/crm/follow-ups', {
        method: 'POST',
        body: JSON.stringify({
          title: followUpTitle.trim(),
          followUpDate,
          entityType: 'LEAD',
          entityId: selectedLead.id,
        }),
      })
      toast.success('Follow-up scheduled')
      setFollowUpDialogOpen(false)
      setFollowUpTitle('')
      setFollowUpDate('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to schedule follow-up'
      toast.error(message)
    } finally {
      setSavingFollowUp(false)
    }
  }

  const filteredLeads = debouncedSearch
    ? leads.filter(
        (l) =>
          getLeadName(l).toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          l.email?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          l.mobile?.includes(debouncedSearch) ||
          l.company?.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : leads

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Telecaller Console</h1>
        <p className='mt-1 text-muted-foreground'>
          Make calls and manage lead outreach
        </p>
      </div>

      {/* Main Layout */}
      <div className='grid gap-4 lg:grid-cols-[340px_1fr]'>
        {/* Left Panel: Lead List */}
        <Card className='flex flex-col overflow-hidden'>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base'>Leads</CardTitle>
            <div className='relative mt-2'>
              <Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                placeholder='Search leads...'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='pl-9'
                aria-label='Search leads'
              />
            </div>
          </CardHeader>

          <div className='flex-1 overflow-hidden'>
            {loadingLeads ? (
              <LeadListSkeleton />
            ) : leadsError ? (
              <div className='flex flex-col items-center justify-center gap-2 p-6 text-center'>
                <AlertCircle className='size-8 text-destructive/60' />
                <p className='text-sm text-destructive'>{leadsError}</p>
                <Button size='sm' variant='outline' onClick={fetchLeads}>
                  Retry
                </Button>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className='flex flex-col items-center justify-center gap-2 p-6 text-center'>
                <Users className='size-8 text-muted-foreground/40' />
                <p className='text-sm text-muted-foreground'>No leads found</p>
              </div>
            ) : (
              <ScrollArea className='h-[calc(100vh-320px)] min-h-[300px] lg:h-[calc(100vh-280px)]'>
                <div className='space-y-1 p-2'>
                  {filteredLeads.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/80 ${
                        selectedLead?.id === lead.id
                          ? 'bg-primary/10 ring-1 ring-primary/20'
                          : ''
                      }`}
                    >
                      <div className='flex items-center gap-3'>
                        <div className='flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium'>
                          {lead.firstName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className='min-w-0 flex-1'>
                          <p className='truncate text-sm font-medium'>{getLeadName(lead)}</p>
                          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                            {lead.company && (
                              <span className='truncate'>{lead.company}</span>
                            )}
                            {lead.mobile && (
                              <span className='truncate'>{lead.mobile}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className='border-t px-4 py-2 text-xs text-muted-foreground'>
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
          </div>
        </Card>

        {/* Right Panel: Lead Details */}
        <div className='space-y-4'>
          {!selectedLead ? (
            <Card>
              <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
                <PhoneCall className='mb-3 size-12 text-muted-foreground/30' />
                <p className='text-sm font-medium text-muted-foreground'>
                  Select a lead to view details
                </p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  Choose a lead from the list to start
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Lead Info Card */}
              <Card>
                <CardHeader className='pb-3'>
                  <div className='flex items-start justify-between'>
                    <div>
                      <CardTitle className='text-lg'>
                        {getLeadName(selectedLead)}
                      </CardTitle>
                      {selectedLead.company && (
                        <p className='mt-0.5 text-sm text-muted-foreground'>
                          {selectedLead.company}
                        </p>
                      )}
                    </div>
                    <div className='flex gap-1.5'>
                      <Badge variant='outline' className={STATUS_BADGE_STYLES[selectedLead.status || ''] || ''}>
                        {selectedLead.status}
                      </Badge>
                      <Badge variant='outline' className={PRIORITY_BADGE_STYLES[selectedLead.priority || ''] || ''}>
                        {selectedLead.priority}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='grid gap-3 sm:grid-cols-2'>
                    {selectedLead.email && (
                      <div className='flex items-center gap-2 text-sm'>
                        <Mail className='size-4 shrink-0 text-muted-foreground' />
                        <a
                          href={`mailto:${selectedLead.email}`}
                          className='truncate text-muted-foreground hover:text-foreground'
                        >
                          {selectedLead.email}
                        </a>
                      </div>
                    )}
                    {selectedLead.mobile && (
                      <div className='flex items-center gap-2 text-sm'>
                        <Phone className='size-4 shrink-0 text-muted-foreground' />
                        <a
                          href={`tel:${selectedLead.mobile}`}
                          className='text-muted-foreground hover:text-foreground'
                        >
                          {selectedLead.mobile}
                        </a>
                      </div>
                    )}
                    {selectedLead.company && (
                      <div className='flex items-center gap-2 text-sm'>
                        <Building className='size-4 shrink-0 text-muted-foreground' />
                        <span className='text-muted-foreground'>{selectedLead.company}</span>
                      </div>
                    )}
                    {selectedLead.source && (
                      <div className='flex items-center gap-2 text-sm'>
                        <FileText className='size-4 shrink-0 text-muted-foreground' />
                        <span className='text-muted-foreground'>{selectedLead.source}</span>
                      </div>
                    )}
                    {selectedLead.owner && (
                      <div className='flex items-center gap-2 text-sm'>
                        <User className='size-4 shrink-0 text-muted-foreground' />
                        <span className='text-muted-foreground'>
                          {selectedLead.owner.name || selectedLead.owner.email}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {selectedLead.notes && (
                    <div className='rounded-lg border bg-muted/30 p-3'>
                      <p className='mb-1 text-xs font-medium text-muted-foreground'>Notes</p>
                      <p className='whitespace-pre-wrap text-sm'>{selectedLead.notes}</p>
                    </div>
                  )}

                  {/* Recording notice */}
                  {!recordingAvailable && (
                    <div className='flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400'>
                      <Info className='size-3.5 shrink-0' />
                      Call recording unavailable - provider not configured
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Buttons - Bottom on mobile, inline on desktop */}
              <Card>
                <CardContent className='p-4'>
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      onClick={handleStartCall}
                      disabled={creatingCall || !selectedLead.mobile}
                      className='flex-1 sm:flex-none'
                    >
                      {creatingCall ? (
                        <Loader2 className='size-4 animate-spin' />
                      ) : (
                        <Phone className='size-4' />
                      )}
                      Call
                    </Button>
                    <Button
                      variant='outline'
                      onClick={() => {
                        setNoteText('')
                        setNoteDialogOpen(true)
                      }}
                      className='flex-1 sm:flex-none'
                    >
                      <StickyNote className='size-4' />
                      Add Note
                    </Button>
                    <Button
                      variant='outline'
                      onClick={() => {
                        setFollowUpTitle(`Follow up with ${getLeadName(selectedLead)}`)
                        setFollowUpDate('')
                        setFollowUpDialogOpen(true)
                      }}
                      className='flex-1 sm:flex-none'
                    >
                      <CalendarClock className='size-4' />
                      Schedule Follow-up
                    </Button>
                    <Button
                      variant='ghost'
                      onClick={() => router.push(`/crm/leads/${selectedLead.id}`)}
                      className='flex-1 sm:flex-none'
                    >
                      <ExternalLink className='size-4' />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Call History */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center gap-2 text-base'>
                    <PhoneCall className='size-4' />
                    Recent Calls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingCalls ? (
                    <div className='space-y-2'>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className='h-12 w-full' />
                      ))}
                    </div>
                  ) : leadCalls.length === 0 ? (
                    <p className='text-center text-sm text-muted-foreground'>
                      No call history found
                    </p>
                  ) : (
                    <ScrollArea className='max-h-64'>
                      <div className='space-y-2'>
                        {leadCalls.map((call) => (
                          <div
                            key={call.id}
                            className='flex items-center justify-between gap-3 rounded-lg border p-3'
                          >
                            <div className='flex items-center gap-3'>
                              {call.direction === 'OUTBOUND' ? (
                                <PhoneOff className='size-4 text-muted-foreground' />
                              ) : (
                                <Phone className='size-4 text-muted-foreground' />
                              )}
                              <div>
                                <p className='text-sm font-medium'>
                                  {call.direction === 'OUTBOUND' ? 'Outbound' : 'Inbound'}
                                </p>
                                <p className='text-xs text-muted-foreground'>
                                  {formatDateTime(call.createdAt)}
                                </p>
                              </div>
                            </div>
                            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                              {call.callStatus === 'MISSED' && (
                                <Badge variant='outline' className='border-red-200 text-red-600'>
                                  Missed
                                </Badge>
                              )}
                              <span>{formatDuration(call.duration)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Call Dialog */}
      <Dialog open={callDialogOpen} onOpenChange={(open) => {
        if (!open && !endingCall) {
          setCallDialogOpen(false)
          setActiveCall(null)
        }
      }}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Phone className='size-5 text-green-600' />
              Call in Progress
            </DialogTitle>
            <DialogDescription>
              Calling {selectedLead ? getLeadName(selectedLead) : 'lead'}...
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            {/* Contact Info */}
            {selectedLead && (
              <div className='rounded-lg bg-muted/50 p-3 text-sm'>
                <p className='font-medium'>{getLeadName(selectedLead)}</p>
                {selectedLead.mobile && (
                  <p className='mt-1 text-muted-foreground'>{selectedLead.mobile}</p>
                )}
                {selectedLead.email && (
                  <p className='text-muted-foreground'>{selectedLead.email}</p>
                )}
              </div>
            )}

            {/* Disposition */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Call Disposition</label>
              <div className='grid grid-cols-2 gap-2'>
                {DISPOSITION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDisposition(opt.value)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      disposition === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Call Notes */}
            <div className='space-y-2'>
              <label htmlFor='call-notes' className='text-sm font-medium'>
                Call Notes
              </label>
              <Textarea
                id='call-notes'
                placeholder='Add notes about this call...'
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                rows={3}
              />
            </div>

            {!recordingAvailable && (
              <div className='flex items-center gap-2 text-xs text-amber-600'>
                <Info className='size-3.5 shrink-0' />
                Call recording unavailable - provider not configured
              </div>
            )}
          </div>

          <DialogFooter className='gap-2'>
            <Button
              variant='destructive'
              onClick={handleEndCall}
              disabled={endingCall}
            >
              {endingCall ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <PhoneOff className='size-4' />
              )}
              End Call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add a note for {selectedLead ? getLeadName(selectedLead) : 'this lead'}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder='Enter your note...'
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={5}
            autoFocus
          />
          <DialogFooter className='gap-2'>
            <Button variant='outline' onClick={() => setNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveNote}
              disabled={savingNote || !noteText.trim()}
            >
              {savingNote && <Loader2 className='size-4 animate-spin' />}
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Follow-up Dialog */}
      <Dialog open={followUpDialogOpen} onOpenChange={setFollowUpDialogOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Schedule Follow-up</DialogTitle>
            <DialogDescription>
              Schedule a follow-up for {selectedLead ? getLeadName(selectedLead) : 'this lead'}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <label htmlFor='fu-title' className='text-sm font-medium'>
                Title <span className='text-destructive'>*</span>
              </label>
              <Input
                id='fu-title'
                placeholder='Follow-up title...'
                value={followUpTitle}
                onChange={(e) => setFollowUpTitle(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <label htmlFor='fu-date' className='text-sm font-medium'>
                Date & Time <span className='text-destructive'>*</span>
              </label>
              <Input
                id='fu-date'
                type='datetime-local'
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className='gap-2'>
            <Button variant='outline' onClick={() => setFollowUpDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleScheduleFollowUp}
              disabled={savingFollowUp || !followUpTitle.trim() || !followUpDate}
            >
              {savingFollowUp && <Loader2 className='size-4 animate-spin' />}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
