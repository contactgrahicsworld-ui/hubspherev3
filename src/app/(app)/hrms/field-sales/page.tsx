'use client'

import { useEffect, useState, useCallback, type FormEvent } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  MapPin, AlertCircle, Plus, Loader2, ClipboardList, Users, CalendarCheck, Clock, Receipt, Eye,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface FieldDashboardData {
  visits: {
    today: number
    completedToday: number
    pending: number
    missedToday: number
  }
  followUps: { due: number }
  fieldEmployees: { count: number }
  expenses: { pendingApproval: number }
}

interface FieldVisit {
  id: string
  employeeId: string
  date: string
  purpose: string | null
  outcome: string | null
  notes: string | null
  status: string
  startTime: string | null
  endTime: string | null
  nextFollowUp: string | null
  employee: {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    department: { name: string } | null
  }
  lead: { id: string; firstName: string; lastName: string; company: string | null } | null
  contact: { id: string; firstName: string; lastName: string; email: string; company: { name: string } | null } | null
}

interface Employee {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  department: { name: string } | null
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

interface MetricCard {
  label: string
  value: number
  icon: React.ReactNode
  variant?: 'default' | 'warning' | 'danger' | 'success'
}

// ============================================
// Helpers
// ============================================

function employeeFullName(emp: { firstName: string; lastName: string | null }) {
  return [emp.firstName, emp.lastName].filter(Boolean).join(' ') || '-'
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return '-' }
}

function visitStatusVariant(status: string) {
  switch (status) {
    case 'COMPLETED': return 'default' as const
    case 'PLANNED': return 'outline' as const
    case 'STARTED': return 'secondary' as const
    case 'CANCELLED': return 'destructive' as const
    case 'MISSED': return 'destructive' as const
    default: return 'outline' as const
  }
}

function renderPageNumbers(page: number, totalPages: number) {
  const pages: number[] = []
  const maxVisible = 5
  let start = Math.max(1, page - Math.floor(maxVisible / 2))
  const end = Math.min(totalPages, start + maxVisible - 1)
  if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
}

// ============================================
// Sub-Components
// ============================================

function MetricCardSkeleton() {
  return (
    <Card><CardContent className='p-4'><div className='flex items-center gap-3'><Skeleton className='size-9 rounded-lg' /><div className='flex-1 space-y-1'><Skeleton className='h-3 w-24' /><Skeleton className='h-6 w-16' /></div></div></CardContent></Card>
  )
}

function MetricCardDisplay({ card }: { card: MetricCard }) {
  const vc: Record<string, string> = {
    default: 'bg-primary/10 text-primary',
    warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    danger: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  }
  return (
    <Card><CardContent className='p-4'><div className='flex items-center gap-3'>
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${vc[card.variant ?? 'default']}`}>{card.icon}</div>
      <div className='min-w-0 flex-1'><p className='truncate text-xs text-muted-foreground'>{card.label}</p><p className='text-xl font-semibold leading-tight'>{card.value.toLocaleString()}</p></div>
    </div></CardContent></Card>
  )
}

function TableSkeleton() {
  return (
    <Card><CardContent className='p-0'><Table><TableHeader><TableRow>{Array.from({ length: 5 }).map((_, i) => <TableHead key={i}><Skeleton className='h-4 w-24' /></TableHead>)}</TableRow></TableHeader>
    <TableBody>{Array.from({ length: 5 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className='h-4 w-full' /></TableCell>)}</TableRow>)}</TableBody></Table></CardContent></Card>
  )
}

function MobileVisitCard({ visit, onUpdate }: { visit: FieldVisit; onUpdate: () => void }) {
  const [updating, setUpdating] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [outcome, setOutcome] = useState(visit.outcome || '')
  const [notes, setNotes] = useState(visit.notes || '')
  const [status, setStatus] = useState(visit.status)

  const handleUpdate = async () => {
    try {
      setUpdating(true)
      const body: Record<string, unknown> = { status }
      if (outcome.trim()) body.outcome = outcome.trim()
      if (notes.trim()) body.notes = notes.trim()
      await apiFetch(`/api/v1/hrms/field-visits/${visit.id}`, { method: 'PUT', body: JSON.stringify(body) })
      toast.success('Visit updated')
      setUpdateOpen(false)
      onUpdate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <>
      <Card>
        <CardContent className='p-4'>
          <div className='flex items-start justify-between gap-2'>
            <div className='min-w-0'>
              <p className='font-medium truncate'>{employeeFullName(visit.employee)}</p>
              <p className='text-xs text-muted-foreground'>{formatDate(visit.date)}</p>
            </div>
            <Badge variant={visitStatusVariant(visit.status)}>{visit.status}</Badge>
          </div>
          {visit.purpose && <p className='mt-2 text-xs text-muted-foreground line-clamp-2'>{visit.purpose}</p>}
          <div className='mt-2 flex gap-2'>
            <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
              <DialogTrigger asChild><Button variant='outline' size='sm'><Eye className='size-3' />Details</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Visit Details</DialogTitle><DialogDescription>View and update visit information.</DialogDescription></DialogHeader>
                <div className='space-y-4'>
                  <div className='space-y-2'><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='PLANNED'>Planned</SelectItem><SelectItem value='STARTED'>Started</SelectItem><SelectItem value='COMPLETED'>Completed</SelectItem><SelectItem value='MISSED'>Missed</SelectItem><SelectItem value='CANCELLED'>Cancelled</SelectItem></SelectContent></Select></div>
                  <div className='space-y-2'><Label>Outcome</Label><Textarea rows={2} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder='Visit outcome...' /></div>
                  <div className='space-y-2'><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder='Additional notes...' /></div>
                </div>
                <DialogFooter>
                  <Button variant='outline' onClick={() => setUpdateOpen(false)}>Cancel</Button>
                  <Button onClick={handleUpdate} disabled={updating}>{updating ? <><Loader2 className='size-4 animate-spin' />Saving...</> : 'Save'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

// ============================================
// Main Page
// ============================================

export default function FieldSalesPage() {
  const [activeTab, setActiveTab] = useState('dashboard')

  // Dashboard state
  const [dashData, setDashData] = useState<FieldDashboardData | null>(null)
  const [dashLoading, setDashLoading] = useState(true)
  const [dashError, setDashError] = useState<string | null>(null)

  // Visits state
  const [visits, setVisits] = useState<FieldVisit[]>([])
  const [vPage, setVPage] = useState(1)
  const [vTotalPages, setVTotalPages] = useState(1)
  const [vTotal, setVTotal] = useState(0)
  const [vLoading, setVLoading] = useState(true)
  const [vError, setVError] = useState<string | null>(null)
  const [vStatusFilter, setVStatusFilter] = useState('')

  // Add visit dialog
  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ employeeId: '', date: '', purpose: '', notes: '', nextFollowUp: '' })
  const [employees, setEmployees] = useState<Employee[]>([])

  // Update visit dialog
  const [updateVisitId, setUpdateVisitId] = useState<string | null>(null)
  const [updateOutcome, setUpdateOutcome] = useState('')
  const [updateNotes, setUpdateNotes] = useState('')
  const [updateStatus, setUpdateStatus] = useState('')
  const [updating, setUpdating] = useState(false)

  // Fetch Dashboard
  const fetchDashboard = useCallback(async () => {
    try {
      setDashLoading(true)
      setDashError(null)
      const res = await apiFetch<{ data: FieldDashboardData }>('/api/v1/hrms/field-dashboard')
      setDashData(res.data)
    } catch (err) {
      setDashError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setDashLoading(false)
    }
  }, [])

  // Fetch Visits
  const fetchVisits = useCallback(async (p: number) => {
    try {
      setVLoading(true)
      setVError(null)
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (vStatusFilter) params.set('status', vStatusFilter)
      const data = await apiFetch<PaginatedResponse<FieldVisit>>(`/api/v1/hrms/field-visits?${params}`)
      setVisits(data.data)
      setVTotalPages(data.pagination.totalPages)
      setVTotal(data.pagination.total)
    } catch (err) {
      setVError(err instanceof Error ? err.message : 'Failed to load visits')
    } finally {
      setVLoading(false)
    }
  }, [vStatusFilter])

  // Fetch employees
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await apiFetch<PaginatedResponse<Employee>>('/api/v1/hrms/employees?limit=200&employmentStatus=ACTIVE')
      setEmployees(res.data)
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])
  useEffect(() => { fetchVisits(vPage) }, [vPage, fetchVisits])
  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  const handleAddVisit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.employeeId || !form.date) return
    try {
      setAdding(true)
      const body: Record<string, unknown> = { employeeId: form.employeeId, date: form.date }
      if (form.purpose.trim()) body.purpose = form.purpose.trim()
      if (form.notes.trim()) body.notes = form.notes.trim()
      if (form.nextFollowUp) body.nextFollowUp = form.nextFollowUp
      await apiFetch('/api/v1/hrms/field-visits', { method: 'POST', body: JSON.stringify(body) })
      toast.success('Field visit created successfully')
      setAddOpen(false)
      setForm({ employeeId: '', date: '', purpose: '', notes: '', nextFollowUp: '' })
      fetchVisits(1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create visit')
    } finally {
      setAdding(false)
    }
  }

  const openUpdateDialog = (visit: FieldVisit) => {
    setUpdateVisitId(visit.id)
    setUpdateOutcome(visit.outcome || '')
    setUpdateNotes(visit.notes || '')
    setUpdateStatus(visit.status)
  }

  const handleUpdateVisit = async () => {
    if (!updateVisitId) return
    try {
      setUpdating(true)
      const body: Record<string, unknown> = { status: updateStatus }
      if (updateOutcome.trim()) body.outcome = updateOutcome.trim()
      if (updateNotes.trim()) body.notes = updateNotes.trim()
      await apiFetch(`/api/v1/hrms/field-visits/${updateVisitId}`, { method: 'PUT', body: JSON.stringify(body) })
      toast.success('Visit updated')
      setUpdateVisitId(null)
      fetchVisits(vPage)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update visit')
    } finally {
      setUpdating(false)
    }
  }

  // Dashboard metrics
  const dashboardMetrics: MetricCard[] = dashData ? [
    { label: "Today's Visits", value: dashData.visits.today, icon: <MapPin className='size-4' /> },
    { label: 'Completed Today', value: dashData.visits.completedToday, icon: <CalendarCheck className='size-4' />, variant: 'success' },
    { label: 'Pending Visits', value: dashData.visits.pending, icon: <Clock className='size-4' />, variant: 'warning' },
    { label: 'Missed Today', value: dashData.visits.missedToday, icon: <AlertCircle className='size-4' />, variant: dashData.visits.missedToday > 0 ? 'danger' : 'default' },
    { label: 'Follow-ups Due', value: dashData.followUps.due, icon: <ClipboardList className='size-4' />, variant: dashData.followUps.due > 0 ? 'warning' : 'default' },
    { label: 'Field Employees', value: dashData.fieldEmployees.count, icon: <Users className='size-4' /> },
    { label: 'Pending Expenses', value: dashData.expenses.pendingApproval, icon: <Receipt className='size-4' />, variant: dashData.expenses.pendingApproval > 0 ? 'warning' : 'default' },
  ] : []

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Field Sales</h1>
          <p className='text-muted-foreground mt-1'>Track field visits and field team performance</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><Button><Plus className='size-4' />New Visit</Button></DialogTrigger>
          <DialogContent className='max-h-[90vh] overflow-y-auto'>
            <DialogHeader><DialogTitle>Schedule Field Visit</DialogTitle><DialogDescription>Plan a new field visit for an employee.</DialogDescription></DialogHeader>
            <form onSubmit={handleAddVisit} className='space-y-4'>
              <div className='space-y-2'><Label htmlFor='fv-employee'>Employee *</Label><Select value={form.employeeId} onValueChange={(v) => setForm({ ...form, employeeId: v })}><SelectTrigger id='fv-employee'><SelectValue placeholder='Select employee' /></SelectTrigger><SelectContent>{employees.map((emp) => <SelectItem key={emp.id} value={emp.id}>{employeeFullName(emp)} ({emp.employeeId})</SelectItem>)}</SelectContent></Select></div>
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'><Label htmlFor='fv-date'>Date *</Label><Input id='fv-date' type='date' value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
                <div className='space-y-2'><Label htmlFor='fv-followup'>Follow-up Date</Label><Input id='fv-followup' type='date' value={form.nextFollowUp} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} /></div>
              </div>
              <div className='space-y-2'><Label htmlFor='fv-purpose'>Purpose</Label><Textarea id='fv-purpose' placeholder='Visit purpose...' rows={2} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
              <div className='space-y-2'><Label htmlFor='fv-notes'>Notes</Label><Textarea id='fv-notes' placeholder='Additional notes...' rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <DialogFooter>
                <Button type='button' variant='outline' onClick={() => setAddOpen(false)} disabled={adding}>Cancel</Button>
                <Button type='submit' disabled={adding || !form.employeeId || !form.date}>{adding ? <><Loader2 className='size-4 animate-spin' />Creating...</> : 'Schedule'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value='dashboard'>Dashboard</TabsTrigger>
          <TabsTrigger value='visits'>Visits</TabsTrigger>
        </TabsList>

        {/* DASHBOARD TAB */}
        <TabsContent value='dashboard' className='space-y-4'>
          {dashLoading && (
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7'>
              {Array.from({ length: 7 }).map((_, i) => <MetricCardSkeleton key={i} />)}
            </div>
          )}
          {dashError && !dashLoading && (
            <Card className='border-destructive/50'><CardContent className='flex items-center gap-3 py-6'><AlertCircle className='size-5 text-destructive shrink-0' /><p className='text-sm text-destructive'>{dashError}</p></CardContent></Card>
          )}
          {!dashLoading && !dashError && dashData && (
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7'>
              {dashboardMetrics.map((m) => <MetricCardDisplay key={m.label} card={m} />)}
            </div>
          )}
        </TabsContent>

        {/* VISITS TAB */}
        <TabsContent value='visits' className='space-y-4'>
          <div className='flex items-center gap-3'>
            <Select value={vStatusFilter || '_all'} onValueChange={(v) => { setVStatusFilter(v === '_all' ? '' : v); setVPage(1) }}>
              <SelectTrigger className='w-[160px]'><SelectValue placeholder='All Statuses' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='_all'>All Statuses</SelectItem>
                <SelectItem value='PLANNED'>Planned</SelectItem>
                <SelectItem value='STARTED'>Started</SelectItem>
                <SelectItem value='COMPLETED'>Completed</SelectItem>
                <SelectItem value='MISSED'>Missed</SelectItem>
                <SelectItem value='CANCELLED'>Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {vLoading && <TableSkeleton />}
          {vError && !vLoading && <Card className='border-destructive/50'><CardContent className='flex items-center gap-3 py-6'><AlertCircle className='size-5 text-destructive shrink-0' /><p className='text-sm text-destructive'>{vError}</p></CardContent></Card>}
          {!vLoading && !vError && visits.length === 0 && (
            <Card><CardContent className='flex flex-col items-center justify-center py-12 text-center'><MapPin className='size-10 text-muted-foreground/50 mb-3' /><p className='text-sm font-medium text-muted-foreground'>No field visits</p><p className='text-xs text-muted-foreground mt-1'>Schedule a new field visit to get started.</p></CardContent></Card>
          )}
          {!vLoading && !vError && visits.length > 0 && (
            <>
              <Card className='hidden md:block'><CardContent className='p-0'><Table>
                <TableHeader><TableRow>
                  <TableHead>Employee</TableHead><TableHead>Date</TableHead><TableHead>Purpose</TableHead><TableHead>Outcome</TableHead><TableHead>Status</TableHead><TableHead className='w-[80px]'>Action</TableHead>
                </TableRow></TableHeader>
                <TableBody>{visits.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell><div><p className='font-medium'>{employeeFullName(v.employee)}</p><p className='text-xs text-muted-foreground'>{v.employee.department?.name || ''}</p></div></TableCell>
                    <TableCell className='text-xs'>{formatDate(v.date)}</TableCell>
                    <TableCell className='max-w-[200px] truncate text-sm'>{v.purpose || '-'}</TableCell>
                    <TableCell className='max-w-[200px] truncate text-sm'>{v.outcome || '-'}</TableCell>
                    <TableCell><Badge variant={visitStatusVariant(v.status)}>{v.status}</Badge></TableCell>
                    <TableCell>
                      <Button variant='ghost' size='sm' onClick={() => openUpdateDialog(v)}><Eye className='size-3' /></Button>
                    </TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table></CardContent></Card>

              <div className='flex flex-col gap-3 md:hidden'>
                {visits.map((v) => <MobileVisitCard key={v.id} visit={v} onUpdate={() => fetchVisits(vPage)} />)}
              </div>

              {vTotalPages > 1 && (
                <div className='flex flex-col items-center gap-2'>
                  <p className='text-xs text-muted-foreground'>Showing {visits.length} of {vTotal}</p>
                  <Pagination><PaginationContent>
                    <PaginationItem><PaginationPrevious href='#' onClick={(e) => { e.preventDefault(); if (vPage > 1) setVPage(vPage - 1) }} aria-disabled={vPage <= 1} className={vPage <= 1 ? 'pointer-events-none opacity-50' : ''} /></PaginationItem>
                    {renderPageNumbers(vPage, vTotalPages).map((p) => <PaginationItem key={p}><PaginationLink href='#' isActive={p === vPage} onClick={(e) => { e.preventDefault(); setVPage(p) }}>{p}</PaginationLink></PaginationItem>)}
                    <PaginationItem><PaginationNext href='#' onClick={(e) => { e.preventDefault(); if (vPage < vTotalPages) setVPage(vPage + 1) }} aria-disabled={vPage >= vTotalPages} className={vPage >= vTotalPages ? 'pointer-events-none opacity-50' : ''} /></PaginationItem>
                  </PaginationContent></Pagination>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Update Visit Dialog */}
      <Dialog open={!!updateVisitId} onOpenChange={(open) => { if (!open) setUpdateVisitId(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Visit</DialogTitle><DialogDescription>Update visit status and details.</DialogDescription></DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'><Label>Status</Label><Select value={updateStatus} onValueChange={setUpdateStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value='PLANNED'>Planned</SelectItem><SelectItem value='STARTED'>Started</SelectItem><SelectItem value='COMPLETED'>Completed</SelectItem><SelectItem value='MISSED'>Missed</SelectItem><SelectItem value='CANCELLED'>Cancelled</SelectItem></SelectContent></Select></div>
            <div className='space-y-2'><Label>Outcome</Label><Textarea rows={2} value={updateOutcome} onChange={(e) => setUpdateOutcome(e.target.value)} placeholder='Visit outcome...' /></div>
            <div className='space-y-2'><Label>Notes</Label><Textarea rows={2} value={updateNotes} onChange={(e) => setUpdateNotes(e.target.value)} placeholder='Additional notes...' /></div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setUpdateVisitId(null)}>Cancel</Button>
            <Button onClick={handleUpdateVisit} disabled={updating}>{updating ? <><Loader2 className='size-4 animate-spin' />Saving...</> : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
