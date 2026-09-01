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
  CalendarOff, AlertCircle, Plus, Loader2, CheckCircle2, XCircle, Ban,
} from 'lucide-react'
import { TableSkeleton } from '@/components/skeletons'

// ============================================
// Types
// ============================================

interface LeaveType {
  id: string
  name: string
  code: string
  description: string | null
  defaultDays: number
  paid: boolean
  carryForward: boolean
  status: string
}

interface LeaveRequest {
  id: string
  employeeId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  totalDays: number | null
  reason: string | null
  status: string
  rejectionReason: string | null
  approvedAt: string | null
  createdAt: string
  employee: {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    department: { name: string } | null
    designation: { title: string } | null
  }
  leaveType: {
    id: string
    name: string
    code: string
    paid: boolean
  }
  approver: { id: string; name: string; email: string } | null
}

interface Employee {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  department: { name: string } | null
  designation: { title: string } | null
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

// ============================================
// Helpers
// ============================================

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '-'
  }
}

function employeeFullName(emp: { firstName: string; lastName: string | null }) {
  return [emp.firstName, emp.lastName].filter(Boolean).join(' ') || '-'
}

function leaveStatusVariant(status: string) {
  switch (status) {
    case 'APPROVED': return 'default' as const
    case 'PENDING': return 'secondary' as const
    case 'REJECTED': return 'destructive' as const
    case 'CANCELLED': return 'outline' as const
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


function MobileLeaveCard({ req }: { req: LeaveRequest }) {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <p className='font-medium truncate'>{employeeFullName(req.employee)}</p>
            <p className='text-xs text-muted-foreground'>{req.leaveType.name}</p>
          </div>
          <Badge variant={leaveStatusVariant(req.status)}>{req.status}</Badge>
        </div>
        <div className='mt-3 space-y-1 text-xs text-muted-foreground'>
          <p>{formatDate(req.startDate)} — {formatDate(req.endDate)} ({req.totalDays ?? '-'} days)</p>
          {req.reason && <p className='line-clamp-2'>{req.reason}</p>}
          {req.rejectionReason && <p className='text-destructive'>Rejected: {req.rejectionReason}</p>}
        </div>
        {req.status === 'PENDING' && (
          <div className='mt-3 flex gap-2'>
            <LeaveActionButtons req={req} onAction={() => {}} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function LeaveActionButtons({ req, onAction }: { req: LeaveRequest; onAction: () => void }) {
  const [acting, setActing] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const handleAction = async (action: 'APPROVE' | 'REJECT' | 'CANCEL') => {
    try {
      setActing(action)
      const body: Record<string, unknown> = { action }
      if (action === 'REJECT' && rejectReason.trim()) body.rejectionReason = rejectReason.trim()
      await apiFetch(`/api/v1/hrms/leave-requests/${req.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      toast.success(`Leave ${action.toLowerCase()}d`)
      setRejectOpen(false)
      setRejectReason('')
      onAction()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed'
      toast.error(msg)
    } finally {
      setActing(null)
    }
  }

  return (
    <>
      <Button size='sm' variant='outline' onClick={() => handleAction('APPROVE')} disabled={acting !== null}>
        {acting === 'APPROVE' ? <Loader2 className='size-3 animate-spin' /> : <CheckCircle2 className='size-3 text-emerald-600' />}
        <span className='ml-1'>Approve</span>
      </Button>
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger asChild>
          <Button size='sm' variant='outline' disabled={acting !== null}>
            {acting === 'REJECT' ? <Loader2 className='size-3 animate-spin' /> : <XCircle className='size-3 text-red-600' />}
            <span className='ml-1'>Reject</span>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this request.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder='Rejection reason...' rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant='outline' onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant='destructive' onClick={() => handleAction('REJECT')}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button size='sm' variant='outline' onClick={() => handleAction('CANCEL')} disabled={acting !== null}>
        <Ban className='size-3' /><span className='ml-1'>Cancel</span>
      </Button>
    </>
  )
}

// ============================================
// Main Page
// ============================================

export default function LeavePage() {
  const [activeTab, setActiveTab] = useState('requests')

  // Leave Types State
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [ltPage, setLtPage] = useState(1)
  const [ltTotalPages, setLtTotalPages] = useState(1)
  const [ltTotal, setLtTotal] = useState(0)
  const [ltLoading, setLtLoading] = useState(true)
  const [ltError, setLtError] = useState<string | null>(null)

  const [addLtOpen, setAddLtOpen] = useState(false)
  const [addingLt, setAddingLt] = useState(false)
  const [ltForm, setLtForm] = useState({ name: '', code: '', description: '', defaultDays: '', paid: 'true', carryForward: 'false' })

  // Leave Requests State
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [lrPage, setLrPage] = useState(1)
  const [lrTotalPages, setLrTotalPages] = useState(1)
  const [lrTotal, setLrTotal] = useState(0)
  const [lrLoading, setLrLoading] = useState(true)
  const [lrError, setLrError] = useState<string | null>(null)
  const [lrStatusFilter, setLrStatusFilter] = useState('')

  const [addLrOpen, setAddLrOpen] = useState(false)
  const [addingLr, setAddingLr] = useState(false)
  const [lrForm, setLrForm] = useState({ employeeId: '', leaveTypeId: '', startDate: '', endDate: '', reason: '' })
  const [employees, setEmployees] = useState<Employee[]>([])

  // Fetch Leave Types
  const fetchLeaveTypes = useCallback(async (p: number) => {
    try {
      setLtLoading(true)
      setLtError(null)
      const data = await apiFetch<PaginatedResponse<LeaveType>>(`/api/v1/hrms/leave-types?page=${p}&limit=20`)
      setLeaveTypes(data.data)
      setLtTotalPages(data.pagination.totalPages)
      setLtTotal(data.pagination.total)
    } catch (err) {
      setLtError(err instanceof Error ? err.message : 'Failed to load leave types')
    } finally {
      setLtLoading(false)
    }
  }, [])

  // Fetch Leave Requests
  const fetchLeaveRequests = useCallback(async (p: number) => {
    try {
      setLrLoading(true)
      setLrError(null)
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (lrStatusFilter) params.set('status', lrStatusFilter)
      const data = await apiFetch<PaginatedResponse<LeaveRequest>>(`/api/v1/hrms/leave-requests?${params}`)
      setLeaveRequests(data.data)
      setLrTotalPages(data.pagination.totalPages)
      setLrTotal(data.pagination.total)
    } catch (err) {
      setLrError(err instanceof Error ? err.message : 'Failed to load leave requests')
    } finally {
      setLrLoading(false)
    }
  }, [lrStatusFilter])

  // Fetch employees for dropdown
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await apiFetch<PaginatedResponse<Employee>>('/api/v1/hrms/employees?limit=200&employmentStatus=ACTIVE')
      setEmployees(res.data)
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => { fetchLeaveTypes(ltPage) }, [ltPage, fetchLeaveTypes])
  useEffect(() => { fetchLeaveRequests(lrPage) }, [lrPage, fetchLeaveRequests])
  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  const handleAddLeaveType = async (e: FormEvent) => {
    e.preventDefault()
    if (!ltForm.name.trim() || !ltForm.code.trim()) return
    try {
      setAddingLt(true)
      const body: Record<string, unknown> = {
        name: ltForm.name.trim(),
        code: ltForm.code.trim().toUpperCase(),
        defaultDays: parseInt(ltForm.defaultDays) || 0,
        paid: ltForm.paid === 'true',
        carryForward: ltForm.carryForward === 'true',
      }
      if (ltForm.description.trim()) body.description = ltForm.description.trim()
      await apiFetch('/api/v1/hrms/leave-types', { method: 'POST', body: JSON.stringify(body) })
      toast.success('Leave type created successfully')
      setAddLtOpen(false)
      setLtForm({ name: '', code: '', description: '', defaultDays: '', paid: 'true', carryForward: 'false' })
      fetchLeaveTypes(1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create leave type')
    } finally {
      setAddingLt(false)
    }
  }

  const handleAddLeaveRequest = async (e: FormEvent) => {
    e.preventDefault()
    if (!lrForm.employeeId || !lrForm.leaveTypeId || !lrForm.startDate || !lrForm.endDate) return
    try {
      setAddingLr(true)
      const body: Record<string, unknown> = {
        employeeId: lrForm.employeeId,
        leaveTypeId: lrForm.leaveTypeId,
        startDate: lrForm.startDate,
        endDate: lrForm.endDate,
      }
      if (lrForm.reason.trim()) body.reason = lrForm.reason.trim()
      await apiFetch('/api/v1/hrms/leave-requests', { method: 'POST', body: JSON.stringify(body) })
      toast.success('Leave request created successfully')
      setAddLrOpen(false)
      setLrForm({ employeeId: '', leaveTypeId: '', startDate: '', endDate: '', reason: '' })
      fetchLeaveRequests(1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create leave request')
    } finally {
      setAddingLr(false)
    }
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Leave Management</h1>
          <p className='text-muted-foreground mt-1'>Leave types, requests, and approvals</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value='requests'>Leave Requests</TabsTrigger>
          <TabsTrigger value='types'>Leave Types</TabsTrigger>
        </TabsList>

        {/* ==================== LEAVE REQUESTS TAB ==================== */}
        <TabsContent value='requests' className='space-y-4'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <Select value={lrStatusFilter || '_all'} onValueChange={(v) => { setLrStatusFilter(v === '_all' ? '' : v); setLrPage(1) }}>
              <SelectTrigger className='w-[160px]'><SelectValue placeholder='All Statuses' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='_all'>All Statuses</SelectItem>
                <SelectItem value='PENDING'>Pending</SelectItem>
                <SelectItem value='APPROVED'>Approved</SelectItem>
                <SelectItem value='REJECTED'>Rejected</SelectItem>
                <SelectItem value='CANCELLED'>Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={addLrOpen} onOpenChange={setAddLrOpen}>
              <DialogTrigger asChild>
                <Button><Plus className='size-4' />New Request</Button>
              </DialogTrigger>
              <DialogContent className='max-h-[90vh] overflow-y-auto'>
                <DialogHeader>
                  <DialogTitle>New Leave Request</DialogTitle>
                  <DialogDescription>Submit a leave request for an employee.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddLeaveRequest} className='space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='lr-employee'>Employee *</Label>
                    <Select value={lrForm.employeeId} onValueChange={(v) => setLrForm({ ...lrForm, employeeId: v })}>
                      <SelectTrigger id='lr-employee'><SelectValue placeholder='Select employee' /></SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>{employeeFullName(emp)} ({emp.employeeId})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='lr-type'>Leave Type *</Label>
                    <Select value={lrForm.leaveTypeId} onValueChange={(v) => setLrForm({ ...lrForm, leaveTypeId: v })}>
                      <SelectTrigger id='lr-type'><SelectValue placeholder='Select leave type' /></SelectTrigger>
                      <SelectContent>
                        {leaveTypes.filter((lt) => lt.status === 'ACTIVE').map((lt) => (
                          <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='grid grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                      <Label htmlFor='lr-start'>Start Date *</Label>
                      <Input id='lr-start' type='date' value={lrForm.startDate} onChange={(e) => setLrForm({ ...lrForm, startDate: e.target.value })} required />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='lr-end'>End Date *</Label>
                      <Input id='lr-end' type='date' value={lrForm.endDate} onChange={(e) => setLrForm({ ...lrForm, endDate: e.target.value })} required />
                    </div>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='lr-reason'>Reason</Label>
                    <Textarea id='lr-reason' placeholder='Leave reason...' rows={3} value={lrForm.reason} onChange={(e) => setLrForm({ ...lrForm, reason: e.target.value })} />
                  </div>
                  <DialogFooter>
                    <Button type='button' variant='outline' onClick={() => setAddLrOpen(false)} disabled={addingLr}>Cancel</Button>
                    <Button type='submit' disabled={addingLr || !lrForm.employeeId || !lrForm.leaveTypeId || !lrForm.startDate || !lrForm.endDate}>
                      {addingLr ? (<><Loader2 className='size-4 animate-spin' />Submitting...</>) : 'Submit Request'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {lrLoading && <TableSkeleton columns={5} />}
          {lrError && !lrLoading && (
            <Card className='border-destructive/50'>
              <CardContent className='flex items-center gap-3 py-6'>
                <AlertCircle className='size-5 text-destructive shrink-0' />
                <p className='text-sm text-destructive'>{lrError}</p>
              </CardContent>
            </Card>
          )}
          {!lrLoading && !lrError && leaveRequests.length === 0 && (
            <Card>
              <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
                <CalendarOff className='size-10 text-muted-foreground/50 mb-3' />
                <p className='text-sm font-medium text-muted-foreground'>No leave requests</p>
                <p className='text-xs text-muted-foreground mt-1'>Submit a new leave request to get started.</p>
              </CardContent>
            </Card>
          )}
          {!lrLoading && !lrError && leaveRequests.length > 0 && (
            <>
              <Card className='hidden md:block'>
                <CardContent className='p-0'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className='w-[200px]'>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveRequests.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell>
                            <div>
                              <p className='font-medium'>{employeeFullName(req.employee)}</p>
                              <p className='text-xs text-muted-foreground'>{req.employee.department?.name || ''}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className='text-sm'>{req.leaveType.name}</p>
                              <p className='text-xs text-muted-foreground'>{req.leaveType.paid ? 'Paid' : 'Unpaid'}</p>
                            </div>
                          </TableCell>
                          <TableCell className='text-xs'>{formatDate(req.startDate)} — {formatDate(req.endDate)}</TableCell>
                          <TableCell>{req.totalDays ?? '-'}</TableCell>
                          <TableCell><Badge variant={leaveStatusVariant(req.status)}>{req.status}</Badge></TableCell>
                          <TableCell>
                            {req.status === 'PENDING' ? (
                              <LeaveActionButtons req={req} onAction={() => fetchLeaveRequests(lrPage)} />
                            ) : (
                              <span className='text-xs text-muted-foreground'>No actions</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <div className='flex flex-col gap-3 md:hidden'>
                {leaveRequests.map((req) => (
                  <MobileLeaveCard key={req.id} req={req} />
                ))}
              </div>
              {lrTotalPages > 1 && (
                <div className='flex flex-col items-center gap-2'>
                  <p className='text-xs text-muted-foreground'>Showing {leaveRequests.length} of {lrTotal}</p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem><PaginationPrevious href='#' onClick={(e) => { e.preventDefault(); if (lrPage > 1) setLrPage(lrPage - 1) }} aria-disabled={lrPage <= 1} className={lrPage <= 1 ? 'pointer-events-none opacity-50' : ''} /></PaginationItem>
                      {renderPageNumbers(lrPage, lrTotalPages).map((p) => (
                        <PaginationItem key={p}><PaginationLink href='#' isActive={p === lrPage} onClick={(e) => { e.preventDefault(); setLrPage(p) }}>{p}</PaginationLink></PaginationItem>
                      ))}
                      <PaginationItem><PaginationNext href='#' onClick={(e) => { e.preventDefault(); if (lrPage < lrTotalPages) setLrPage(lrPage + 1) }} aria-disabled={lrPage >= lrTotalPages} className={lrPage >= lrTotalPages ? 'pointer-events-none opacity-50' : ''} /></PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ==================== LEAVE TYPES TAB ==================== */}
        <TabsContent value='types' className='space-y-4'>
          <div className='flex justify-end'>
            <Dialog open={addLtOpen} onOpenChange={setAddLtOpen}>
              <DialogTrigger asChild>
                <Button><Plus className='size-4' />Add Leave Type</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Leave Type</DialogTitle>
                  <DialogDescription>Define a new leave type for your organization.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddLeaveType} className='space-y-4'>
                  <div className='grid grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                      <Label htmlFor='lt-name'>Name *</Label>
                      <Input id='lt-name' placeholder='Casual Leave' value={ltForm.name} onChange={(e) => setLtForm({ ...ltForm, name: e.target.value })} required />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='lt-code'>Code *</Label>
                      <Input id='lt-code' placeholder='CL' value={ltForm.code} onChange={(e) => setLtForm({ ...ltForm, code: e.target.value })} required />
                    </div>
                  </div>
                  <div className='grid grid-cols-3 gap-4'>
                    <div className='space-y-2'>
                      <Label htmlFor='lt-days'>Default Days</Label>
                      <Input id='lt-days' type='number' min='0' placeholder='12' value={ltForm.defaultDays} onChange={(e) => setLtForm({ ...ltForm, defaultDays: e.target.value })} />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='lt-paid'>Paid</Label>
                      <Select value={ltForm.paid} onValueChange={(v) => setLtForm({ ...ltForm, paid: v })}>
                        <SelectTrigger id='lt-paid'><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value='true'>Yes</SelectItem>
                          <SelectItem value='false'>No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='lt-carry'>Carry Forward</Label>
                      <Select value={ltForm.carryForward} onValueChange={(v) => setLtForm({ ...ltForm, carryForward: v })}>
                        <SelectTrigger id='lt-carry'><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value='true'>Yes</SelectItem>
                          <SelectItem value='false'>No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='lt-desc'>Description</Label>
                    <Textarea id='lt-desc' placeholder='Description...' rows={2} value={ltForm.description} onChange={(e) => setLtForm({ ...ltForm, description: e.target.value })} />
                  </div>
                  <DialogFooter>
                    <Button type='button' variant='outline' onClick={() => setAddLtOpen(false)} disabled={addingLt}>Cancel</Button>
                    <Button type='submit' disabled={addingLt || !ltForm.name.trim() || !ltForm.code.trim()}>
                      {addingLt ? (<><Loader2 className='size-4 animate-spin' />Creating...</>) : 'Create'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {ltLoading && <TableSkeleton columns={5} />}
          {ltError && !ltLoading && (
            <Card className='border-destructive/50'>
              <CardContent className='flex items-center gap-3 py-6'>
                <AlertCircle className='size-5 text-destructive shrink-0' />
                <p className='text-sm text-destructive'>{ltError}</p>
              </CardContent>
            </Card>
          )}
          {!ltLoading && !ltError && leaveTypes.length === 0 && (
            <Card>
              <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
                <CalendarOff className='size-10 text-muted-foreground/50 mb-3' />
                <p className='text-sm font-medium text-muted-foreground'>No leave types</p>
                <p className='text-xs text-muted-foreground mt-1'>Create your first leave type to define leave policies.</p>
              </CardContent>
            </Card>
          )}
          {!ltLoading && !ltError && leaveTypes.length > 0 && (
            <>
              <Card className='hidden md:block'>
                <CardContent className='p-0'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Default Days</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Carry Forward</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveTypes.map((lt) => (
                        <TableRow key={lt.id}>
                          <TableCell className='font-medium'>{lt.name}</TableCell>
                          <TableCell className='font-mono text-xs'>{lt.code}</TableCell>
                          <TableCell>{lt.defaultDays}</TableCell>
                          <TableCell><Badge variant={lt.paid ? 'default' : 'outline'}>{lt.paid ? 'Yes' : 'No'}</Badge></TableCell>
                          <TableCell><Badge variant={lt.carryForward ? 'default' : 'outline'}>{lt.carryForward ? 'Yes' : 'No'}</Badge></TableCell>
                          <TableCell><Badge variant={lt.status === 'ACTIVE' ? 'default' : 'destructive'}>{lt.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <div className='flex flex-col gap-3 md:hidden'>
                {leaveTypes.map((lt) => (
                  <Card key={lt.id}>
                    <CardContent className='p-4'>
                      <div className='flex items-start justify-between gap-2'>
                        <div className='min-w-0'>
                          <p className='font-medium truncate'>{lt.name}</p>
                          <p className='text-xs text-muted-foreground'>Code: {lt.code}</p>
                        </div>
                        <Badge variant={lt.status === 'ACTIVE' ? 'default' : 'destructive'}>{lt.status}</Badge>
                      </div>
                      <div className='mt-2 flex flex-wrap gap-2'>
                        <Badge variant='outline'>{lt.defaultDays} days</Badge>
                        <Badge variant={lt.paid ? 'default' : 'outline'}>{lt.paid ? 'Paid' : 'Unpaid'}</Badge>
                        {lt.carryForward && <Badge variant='outline'>Carry Forward</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {ltTotalPages > 1 && (
                <div className='flex flex-col items-center gap-2'>
                  <p className='text-xs text-muted-foreground'>Showing {leaveTypes.length} of {ltTotal}</p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem><PaginationPrevious href='#' onClick={(e) => { e.preventDefault(); if (ltPage > 1) setLtPage(ltPage - 1) }} aria-disabled={ltPage <= 1} className={ltPage <= 1 ? 'pointer-events-none opacity-50' : ''} /></PaginationItem>
                      {renderPageNumbers(ltPage, ltTotalPages).map((p) => (
                        <PaginationItem key={p}><PaginationLink href='#' isActive={p === ltPage} onClick={(e) => { e.preventDefault(); setLtPage(p) }}>{p}</PaginationLink></PaginationItem>
                      ))}
                      <PaginationItem><PaginationNext href='#' onClick={(e) => { e.preventDefault(); if (ltPage < ltTotalPages) setLtPage(ltPage + 1) }} aria-disabled={ltPage >= ltTotalPages} className={ltPage >= ltTotalPages ? 'pointer-events-none opacity-50' : ''} /></PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}