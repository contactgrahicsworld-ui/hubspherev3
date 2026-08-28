'use client'

import { useEffect, useState, useCallback, type FormEvent } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  CalendarCheck, AlertCircle, LogIn, LogOut, Loader2, Search,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface AttendanceSession {
  id: string
  employeeId: string
  date: string
  checkInTime: string | null
  checkOutTime: string | null
  status: string
  workingMinutes: number | null
  lateMinutes: number | null
  overtimeMinutes: number | null
  earlyExitMinutes: number | null
  notes: string | null
  employee: {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    department: { name: string } | null
    designation: { title: string } | null
  }
}

interface Employee {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  department: { name: string } | null
  designation: { title: string } | null
}

interface PaginatedResponse {
  data: AttendanceSession[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

// ============================================
// Helpers
// ============================================

function formatTime(dateStr: string | null) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
}

function formatMinutes(m: number | null) {
  if (m == null) return '-'
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h === 0) return `${min}m`
  return `${h}h ${min}m`
}

function statusVariant(status: string) {
  switch (status) {
    case 'PRESENT': return 'default' as const
    case 'LATE': return 'secondary' as const
    case 'HALF_DAY': return 'outline' as const
    case 'ON_LEAVE': return 'secondary' as const
    case 'ABSENT': return 'destructive' as const
    default: return 'outline' as const
  }
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PRESENT: 'Present',
    LATE: 'Late',
    HALF_DAY: 'Half Day',
    ON_LEAVE: 'On Leave',
    ABSENT: 'Absent',
  }
  return labels[status] || status
}

function employeeFullName(emp: { firstName: string; lastName: string | null }) {
  return [emp.firstName, emp.lastName].filter(Boolean).join(' ') || '-'
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

function TableSkeleton() {
  return (
    <Card>
      <CardContent className='p-0'>
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableHead key={i}><Skeleton className='h-4 w-24' /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <TableCell key={j}><Skeleton className='h-4 w-full' /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function MobileAttendanceCard({ session }: { session: AttendanceSession }) {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <p className='font-medium truncate'>{employeeFullName(session.employee)}</p>
            <p className='text-xs text-muted-foreground'>Emp #{session.employee.employeeId}</p>
          </div>
          <Badge variant={statusVariant(session.status)}>{statusLabel(session.status)}</Badge>
        </div>
        <div className='mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground'>
          <div>
            <p className='text-muted-foreground/60'>Check In</p>
            <p className='font-medium text-foreground'>{formatTime(session.checkInTime)}</p>
          </div>
          <div>
            <p className='text-muted-foreground/60'>Check Out</p>
            <p className='font-medium text-foreground'>{formatTime(session.checkOutTime)}</p>
          </div>
          <div>
            <p className='text-muted-foreground/60'>Working</p>
            <p>{formatMinutes(session.workingMinutes)}</p>
          </div>
          <div>
            <p className='text-muted-foreground/60'>Late</p>
            <p>{session.lateMinutes ? `${session.lateMinutes}m` : '-'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page
// ============================================

export default function AttendancePage() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dbUnavailable, setDbUnavailable] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('')

  // Check-in dialog
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState('')

  // Check-out
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null)

  // Reference data
  const [employees, setEmployees] = useState<Employee[]>([])

  const fetchSessions = useCallback(async (p: number) => {
    try {
      setLoading(true)
      setError(null)
      setDbUnavailable(false)
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (statusFilter) params.set('status', statusFilter)
      const data = await apiFetch<PaginatedResponse>(`/api/v1/hrms/attendance?${params}`)
      setSessions(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load attendance'
      if (msg.includes('Database unavailable') || msg.includes('503')) {
        setDbUnavailable(true)
        setError('Database is currently unavailable.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: Employee[] }>('/api/v1/hrms/employees?limit=200&employmentStatus=ACTIVE')
      setEmployees(res.data)
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => { fetchSessions(page) }, [page, fetchSessions])
  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  const handleCheckIn = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedEmployee) return
    try {
      setCheckingIn(true)
      await apiFetch('/api/v1/hrms/attendance', {
        method: 'POST',
        body: JSON.stringify({ employeeId: selectedEmployee }),
      })
      toast.success('Checked in successfully')
      setCheckInOpen(false)
      setSelectedEmployee('')
      fetchSessions(1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to check in'
      toast.error(msg)
    } finally {
      setCheckingIn(false)
    }
  }

  const handleCheckOut = async (sessionId: string) => {
    try {
      setCheckingOutId(sessionId)
      await apiFetch(`/api/v1/hrms/attendance/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify({}),
      })
      toast.success('Checked out successfully')
      fetchSessions(page)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to check out'
      toast.error(msg)
    } finally {
      setCheckingOutId(null)
    }
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Attendance</h1>
          <p className='text-muted-foreground mt-1'>Track daily employee check-ins and check-outs</p>
        </div>
        <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
          <DialogTrigger asChild>
            <Button className='min-w-[130px]'><LogIn className='size-4' />Check In</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Check In</DialogTitle>
              <DialogDescription>Record check-in for an employee.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCheckIn} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='checkin-employee'>Employee *</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger id='checkin-employee'><SelectValue placeholder='Select employee' /></SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {employeeFullName(emp)} ({emp.employeeId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type='button' variant='outline' onClick={() => setCheckInOpen(false)} disabled={checkingIn}>Cancel</Button>
                <Button type='submit' disabled={checkingIn || !selectedEmployee}>
                  {checkingIn ? (<><Loader2 className='size-4 animate-spin' />Checking in...</>) : 'Check In'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <Select value={statusFilter || '_all'} onValueChange={(v) => { setStatusFilter(v === '_all' ? '' : v); setPage(1) }}>
          <SelectTrigger className='w-[160px]'><SelectValue placeholder='All Statuses' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='_all'>All Statuses</SelectItem>
            <SelectItem value='PRESENT'>Present</SelectItem>
            <SelectItem value='LATE'>Late</SelectItem>
            <SelectItem value='HALF_DAY'>Half Day</SelectItem>
            <SelectItem value='ON_LEAVE'>On Leave</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && <TableSkeleton />}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 text-destructive shrink-0' />
            <p className='text-sm text-destructive'>{dbUnavailable ? 'Service temporarily unavailable.' : error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && sessions.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <CalendarCheck className='size-10 text-muted-foreground/50 mb-3' />
            <p className='text-sm font-medium text-muted-foreground'>No attendance records</p>
            <p className='text-xs text-muted-foreground mt-1'>Check in an employee to start tracking attendance.</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && sessions.length > 0 && (
        <>
          <Card className='hidden md:block'>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Working</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className='w-[80px]'>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div>
                          <p className='font-medium'>{employeeFullName(s.employee)}</p>
                          <p className='text-xs text-muted-foreground'>
                            {s.employee.department?.name} {s.employee.designation?.title ? `· ${s.employee.designation.title}` : ''}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className='text-xs'>
                        {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </TableCell>
                      <TableCell>{formatTime(s.checkInTime)}</TableCell>
                      <TableCell>{formatTime(s.checkOutTime)}</TableCell>
                      <TableCell>{formatMinutes(s.workingMinutes)}</TableCell>
                      <TableCell><Badge variant={statusVariant(s.status)}>{statusLabel(s.status)}</Badge></TableCell>
                      <TableCell>
                        {!s.checkOutTime && (
                          <Button
                            variant='outline' size='sm'
                            onClick={() => handleCheckOut(s.id)}
                            disabled={checkingOutId === s.id}
                          >
                            {checkingOutId === s.id ? <Loader2 className='size-3 animate-spin' /> : <LogOut className='size-3' />}
                            <span className='ml-1'>Out</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className='flex flex-col gap-3 md:hidden'>
            {sessions.map((s) => (
              <div key={s.id}>
                <MobileAttendanceCard session={s} />
                {!s.checkOutTime && (
                  <Button
                    variant='outline' size='sm' className='mt-2 w-full'
                    onClick={() => handleCheckOut(s.id)}
                    disabled={checkingOutId === s.id}
                  >
                    {checkingOutId === s.id ? <Loader2 className='size-3 animate-spin' /> : <LogOut className='size-3' />}
                    <span className='ml-1'>Check Out</span>
                  </Button>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>Showing {sessions.length} of {total} records</p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href='#' onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1) }} aria-disabled={page <= 1} className={page <= 1 ? 'pointer-events-none opacity-50' : ''} />
                  </PaginationItem>
                  {renderPageNumbers(page, totalPages).map((p) => (
                    <PaginationItem key={p}>
                      <PaginationLink href='#' isActive={p === page} onClick={(e) => { e.preventDefault(); setPage(p) }}>{p}</PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext href='#' onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1) }} aria-disabled={page >= totalPages} className={page >= totalPages ? 'pointer-events-none opacity-50' : ''} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  )
}
