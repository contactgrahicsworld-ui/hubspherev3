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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import {
  DollarSign, AlertCircle, Plus, Loader2, MoreVertical,
} from 'lucide-react'
import { TableSkeleton } from '@/components/skeletons'

// ============================================
// Types
// ============================================

interface PayrollRecord {
  id: string
  employeeId: string
  periodStart: string
  periodEnd: string
  basicSalary: number
  totalAllowances: number
  totalDeductions: number
  overtimePay: number
  bonus: number
  netSalary: number
  currency: string
  status: string
  paymentMethod: string | null
  paymentRef: string | null
  paidAt: string | null
  notes: string | null
  createdAt: string
  employee: {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    department: { name: string } | null
    designation: { title: string } | null
  }
  creator: { id: string; name: string; email: string } | null
}

interface Employee {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  basicSalary: number | null
  department: { name: string } | null
  designation: { title: string } | null
}

interface PaginatedResponse {
  data: PayrollRecord[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

// ============================================
// Helpers
// ============================================

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return '-' }
}

function formatCurrency(amount: number, currency?: string) {
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₹'
  return `${sym}${amount.toLocaleString()}`
}

function employeeFullName(emp: { firstName: string; lastName: string | null }) {
  return [emp.firstName, emp.lastName].filter(Boolean).join(' ') || '-'
}

function payrollStatusVariant(status: string) {
  switch (status) {
    case 'DRAFT': return 'outline' as const
    case 'PROCESSING': return 'secondary' as const
    case 'FINALIZED': return 'default' as const
    case 'PAID': return 'default' as const
    case 'CANCELLED': return 'destructive' as const
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


function MobilePayrollCard({ record, onStatusChange }: { record: PayrollRecord; onStatusChange: () => void }) {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <p className='font-medium truncate'>{employeeFullName(record.employee)}</p>
            <p className='text-xs text-muted-foreground'>{record.employee.department?.name || ''}</p>
          </div>
          <Badge variant={payrollStatusVariant(record.status)}>{record.status}</Badge>
        </div>
        <div className='mt-3 grid grid-cols-2 gap-2 text-xs'>
          <div><p className='text-muted-foreground/60'>Period</p><p>{formatDate(record.periodStart)} — {formatDate(record.periodEnd)}</p></div>
          <div><p className='text-muted-foreground/60'>Net Salary</p><p className='font-semibold'>{formatCurrency(record.netSalary, record.currency)}</p></div>
        </div>
        <div className='mt-2 flex gap-2'>
          <StatusActions record={record} onStatusChange={onStatusChange} />
        </div>
      </CardContent>
    </Card>
  )
}

function StatusActions({ record, onStatusChange }: { record: PayrollRecord; onStatusChange: () => void }) {
  const [updating, setUpdating] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState(record.notes || '')
  const [targetStatus, setTargetStatus] = useState('')

  const nextStatuses: Record<string, string[]> = {
    DRAFT: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['FINALIZED', 'CANCELLED'],
    FINALIZED: ['PAID'],
    PAID: [],
    CANCELLED: [],
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      setUpdating(true)
      const body: Record<string, unknown> = { status: newStatus }
      if (notes.trim()) body.notes = notes.trim()
      await apiFetch(`/api/v1/hrms/payroll/${record.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      toast.success(`Payroll status updated to ${newStatus}`)
      setNotesOpen(false)
      onStatusChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  const handleStatusClick = (status: string) => {
    setTargetStatus(status)
    setNotesOpen(true)
  }

  const available = nextStatuses[record.status] || []
  if (available.length === 0) return <span className='text-xs text-muted-foreground'>No actions</span>

  return (
    <>
      {available.map((s) => (
        <Button key={s} size='sm' variant='outline' onClick={() => handleStatusClick(s)} disabled={updating}>
          {updating && targetStatus === s ? <Loader2 className='size-3 animate-spin' /> : null}
          <span className='ml-1 capitalize'>{s === 'CANCELLED' ? 'Cancel' : s === 'PAID' ? 'Mark Paid' : `Move to ${s}`}</span>
        </Button>
      ))}
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Payroll</DialogTitle>
            <DialogDescription>Change status to <strong>{targetStatus}</strong> for {employeeFullName(record.employee)}.</DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder='Optional notes...' />
            </div>
            <div className='rounded-lg border p-3 space-y-1 text-xs'>
              <div className='flex justify-between'><span className='text-muted-foreground'>Basic Salary</span><span>{formatCurrency(record.basicSalary, record.currency)}</span></div>
              <div className='flex justify-between'><span className='text-muted-foreground'>Allowances</span><span>{formatCurrency(record.totalAllowances, record.currency)}</span></div>
              <div className='flex justify-between'><span className='text-muted-foreground'>Overtime</span><span>{formatCurrency(record.overtimePay, record.currency)}</span></div>
              <div className='flex justify-between'><span className='text-muted-foreground'>Bonus</span><span>{formatCurrency(record.bonus, record.currency)}</span></div>
              <div className='flex justify-between text-destructive'><span className='text-muted-foreground'>Deductions</span><span>-{formatCurrency(record.totalDeductions, record.currency)}</span></div>
              <div className='border-t pt-1 flex justify-between font-semibold'><span>Net Salary</span><span>{formatCurrency(record.netSalary, record.currency)}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setNotesOpen(false)}>Cancel</Button>
            <Button onClick={() => handleStatusChange(targetStatus)} disabled={updating}>
              {updating ? <><Loader2 className='size-4 animate-spin' />Updating...</> : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ============================================
// Main Page
// ============================================

export default function PayrollPage() {
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dbUnavailable, setDbUnavailable] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('')

  // Add dialog
  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    employeeId: '', periodStart: '', periodEnd: '',
    basicSalary: '', totalAllowances: '', totalDeductions: '',
    overtimePay: '', bonus: '', notes: '',
  })
  const [employees, setEmployees] = useState<Employee[]>([])

  const fetchPayroll = useCallback(async (p: number) => {
    try {
      setLoading(true)
      setError(null)
      setDbUnavailable(false)
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (statusFilter) params.set('status', statusFilter)
      const data = await apiFetch<PaginatedResponse>(`/api/v1/hrms/payroll?${params}`)
      setRecords(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load payroll'
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
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => { fetchPayroll(page) }, [page, fetchPayroll])
  useEffect(() => { if (addOpen) fetchEmployees() }, [addOpen, fetchEmployees])

  const handleEmployeeSelect = (empId: string) => {
    const emp = employees.find((e) => e.id === empId)
    if (emp?.basicSalary) {
      setForm({
        ...form,
        employeeId: empId,
        basicSalary: String(emp.basicSalary),
      })
    } else {
      setForm({ ...form, employeeId: empId })
    }
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.employeeId || !form.periodStart || !form.periodEnd || !form.basicSalary) return
    try {
      setAdding(true)
      const body: Record<string, unknown> = {
        employeeId: form.employeeId,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        basicSalary: parseFloat(form.basicSalary),
        totalAllowances: parseFloat(form.totalAllowances) || 0,
        totalDeductions: parseFloat(form.totalDeductions) || 0,
        overtimePay: parseFloat(form.overtimePay) || 0,
        bonus: parseFloat(form.bonus) || 0,
      }
      if (form.notes.trim()) body.notes = form.notes.trim()
      await apiFetch('/api/v1/hrms/payroll', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      toast.success('Payroll record created successfully')
      setAddOpen(false)
      setForm({ employeeId: '', periodStart: '', periodEnd: '', basicSalary: '', totalAllowances: '', totalDeductions: '', overtimePay: '', bonus: '', notes: '' })
      fetchPayroll(1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create payroll record')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Payroll</h1>
          <p className='text-muted-foreground mt-1'>Manage salary processing and payment tracking</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className='min-w-[150px]'><Plus className='size-4' />Generate Payroll</Button>
          </DialogTrigger>
          <DialogContent className='max-h-[90vh] overflow-y-auto'>
            <DialogHeader>
              <DialogTitle>Generate Payroll</DialogTitle>
              <DialogDescription>Create a new payroll record for an employee.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='pr-employee'>Employee *</Label>
                <Select value={form.employeeId} onValueChange={handleEmployeeSelect}>
                  <SelectTrigger id='pr-employee'><SelectValue placeholder='Select employee' /></SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{employeeFullName(emp)} ({emp.employeeId})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='pr-start'>Period Start *</Label>
                  <Input id='pr-start' type='date' value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} required />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='pr-end'>Period End *</Label>
                  <Input id='pr-end' type='date' value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} required />
                </div>
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='pr-basic'>Basic Salary (₹) *</Label>
                  <Input id='pr-basic' type='number' min='0' step='0.01' placeholder='50000' value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} required />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='pr-allowances'>Allowances (₹)</Label>
                  <Input id='pr-allowances' type='number' min='0' step='0.01' placeholder='0' value={form.totalAllowances} onChange={(e) => setForm({ ...form, totalAllowances: e.target.value })} />
                </div>
              </div>
              <div className='grid grid-cols-3 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='pr-deductions'>Deductions (₹)</Label>
                  <Input id='pr-deductions' type='number' min='0' step='0.01' placeholder='0' value={form.totalDeductions} onChange={(e) => setForm({ ...form, totalDeductions: e.target.value })} />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='pr-overtime'>Overtime (₹)</Label>
                  <Input id='pr-overtime' type='number' min='0' step='0.01' placeholder='0' value={form.overtimePay} onChange={(e) => setForm({ ...form, overtimePay: e.target.value })} />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='pr-bonus'>Bonus (₹)</Label>
                  <Input id='pr-bonus' type='number' step='0.01' placeholder='0' value={form.bonus} onChange={(e) => setForm({ ...form, bonus: e.target.value })} />
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='pr-notes'>Notes</Label>
                <Textarea id='pr-notes' placeholder='Payroll notes...' rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type='button' variant='outline' onClick={() => setAddOpen(false)} disabled={adding}>Cancel</Button>
                <Button type='submit' disabled={adding || !form.employeeId || !form.periodStart || !form.periodEnd || !form.basicSalary}>
                  {adding ? (<><Loader2 className='size-4 animate-spin' />Generating...</>) : 'Generate'}
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
            <SelectItem value='DRAFT'>Draft</SelectItem>
            <SelectItem value='PROCESSING'>Processing</SelectItem>
            <SelectItem value='FINALIZED'>Finalized</SelectItem>
            <SelectItem value='PAID'>Paid</SelectItem>
            <SelectItem value='CANCELLED'>Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && <TableSkeleton columns={6} />}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 text-destructive shrink-0' />
            <p className='text-sm text-destructive'>{dbUnavailable ? 'Service temporarily unavailable.' : error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && records.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <DollarSign className='size-10 text-muted-foreground/50 mb-3' />
            <p className='text-sm font-medium text-muted-foreground'>No payroll records</p>
            <p className='text-xs text-muted-foreground mt-1'>Generate your first payroll record to get started.</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && records.length > 0 && (
        <>
          {/* Desktop Table */}
          <Card className='hidden md:block'>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Basic</TableHead>
                    <TableHead>Net Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className='w-[180px]'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell>
                        <div>
                          <p className='font-medium'>{employeeFullName(rec.employee)}</p>
                          <p className='text-xs text-muted-foreground'>{rec.employee.department?.name || ''} · {rec.employee.designation?.title || ''}</p>
                        </div>
                      </TableCell>
                      <TableCell className='text-xs'>
                        {formatDate(rec.periodStart)} — {formatDate(rec.periodEnd)}
                      </TableCell>
                      <TableCell>{formatCurrency(rec.basicSalary, rec.currency)}</TableCell>
                      <TableCell className='font-medium'>{formatCurrency(rec.netSalary, rec.currency)}</TableCell>
                      <TableCell><Badge variant={payrollStatusVariant(rec.status)}>{rec.status}</Badge></TableCell>
                      <TableCell>
                        <StatusActions record={rec} onStatusChange={() => fetchPayroll(page)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Cards */}
          <div className='flex flex-col gap-3 md:hidden'>
            {records.map((rec) => (
              <MobilePayrollCard key={rec.id} record={rec} onStatusChange={() => fetchPayroll(page)} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>Showing {records.length} of {total} records</p>
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
