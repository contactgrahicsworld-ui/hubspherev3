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
import { Textarea } from '@/components/ui/textarea'
import {
  Receipt, AlertCircle, Plus, Loader2, CheckCircle2, XCircle, Search,
} from 'lucide-react'
import { TableSkeleton } from '@/components/skeletons'

// ============================================
// Types
// ============================================

interface Expense {
  id: string
  employeeId: string
  amount: number
  date: string
  category: string
  description: string | null
  receiptUrl: string | null
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

interface PaginatedResponse {
  data: Expense[]
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

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString()}`
}

function employeeFullName(emp: { firstName: string; lastName: string | null }) {
  return [emp.firstName, emp.lastName].filter(Boolean).join(' ') || '-'
}

function expenseStatusVariant(status: string) {
  switch (status) {
    case 'APPROVED': return 'default' as const
    case 'PENDING': return 'secondary' as const
    case 'REJECTED': return 'destructive' as const
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


function MobileExpenseCard({ expense, onAction }: { expense: Expense; onAction: () => void }) {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <p className='font-medium truncate'>{employeeFullName(expense.employee)}</p>
            <p className='text-xs text-muted-foreground'>{expense.category}</p>
          </div>
          <Badge variant={expenseStatusVariant(expense.status)}>{expense.status}</Badge>
        </div>
        <div className='mt-3 flex items-center justify-between'>
          <p className='text-sm font-semibold'>{formatCurrency(expense.amount)}</p>
          <p className='text-xs text-muted-foreground'>{formatDate(expense.date)}</p>
        </div>
        {expense.description && <p className='mt-2 text-xs text-muted-foreground line-clamp-2'>{expense.description}</p>}
        {expense.rejectionReason && <p className='mt-1 text-xs text-destructive'>{expense.rejectionReason}</p>}
        {expense.status === 'PENDING' && (
          <div className='mt-3 flex gap-2'>
            <ExpenseActionButtons expense={expense} onAction={onAction} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ExpenseActionButtons({ expense, onAction }: { expense: Expense; onAction: () => void }) {
  const [acting, setActing] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const handleAction = async (action: 'APPROVE' | 'REJECT') => {
    try {
      setActing(action)
      const body: Record<string, unknown> = { action }
      if (action === 'REJECT' && rejectReason.trim()) body.rejectionReason = rejectReason.trim()
      await apiFetch(`/api/v1/hrms/expenses/${expense.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      toast.success(`Expense ${action.toLowerCase()}d`)
      setRejectOpen(false)
      setRejectReason('')
      onAction()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
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
          <DialogHeader><DialogTitle>Reject Expense</DialogTitle><DialogDescription>Provide a reason for rejection.</DialogDescription></DialogHeader>
          <Textarea placeholder='Rejection reason...' rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant='outline' onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant='destructive' onClick={() => handleAction('REJECT')}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ============================================
// Main Page
// ============================================

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dbUnavailable, setDbUnavailable] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  // Add dialog
  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    employeeId: '', amount: '', date: '', category: '', description: '',
  })
  const [employees, setEmployees] = useState<Employee[]>([])

  const fetchExpenses = useCallback(async (p: number) => {
    try {
      setLoading(true)
      setError(null)
      setDbUnavailable(false)
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (statusFilter) params.set('status', statusFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      const data = await apiFetch<PaginatedResponse>(`/api/v1/hrms/expenses?${params}`)
      setExpenses(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load expenses'
      if (msg.includes('Database unavailable') || msg.includes('503')) {
        setDbUnavailable(true)
        setError('Database is currently unavailable.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [statusFilter, categoryFilter])

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: Employee[] }>('/api/v1/hrms/employees?limit=200&employmentStatus=ACTIVE')
      setEmployees(res.data)
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => { fetchExpenses(page) }, [page, fetchExpenses])
  useEffect(() => { if (addOpen) fetchEmployees() }, [addOpen, fetchEmployees])

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.employeeId || !form.amount || !form.date || !form.category) return
    try {
      setAdding(true)
      const body: Record<string, unknown> = {
        employeeId: form.employeeId,
        amount: parseFloat(form.amount),
        date: form.date,
        category: form.category.trim(),
      }
      if (form.description.trim()) body.description = form.description.trim()
      await apiFetch('/api/v1/hrms/expenses', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      toast.success('Expense submitted successfully')
      setAddOpen(false)
      setForm({ employeeId: '', amount: '', date: '', category: '', description: '' })
      fetchExpenses(1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit expense')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Expenses</h1>
          <p className='text-muted-foreground mt-1'>Track and approve employee expense claims</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className='min-w-[140px]'><Plus className='size-4' />Submit Expense</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Expense</DialogTitle>
              <DialogDescription>Record a new expense claim.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='exp-employee'>Employee *</Label>
                <Select value={form.employeeId} onValueChange={(v) => setForm({ ...form, employeeId: v })}>
                  <SelectTrigger id='exp-employee'><SelectValue placeholder='Select employee' /></SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{employeeFullName(emp)} ({emp.employeeId})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='exp-amount'>Amount (₹) *</Label>
                  <Input id='exp-amount' type='number' min='0' step='0.01' placeholder='0.00' value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='exp-date'>Date *</Label>
                  <Input id='exp-date' type='date' value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='exp-category'>Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger id='exp-category'><SelectValue placeholder='Select category' /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='Travel'>Travel</SelectItem>
                    <SelectItem value='Food'>Food</SelectItem>
                    <SelectItem value='Accommodation'>Accommodation</SelectItem>
                    <SelectItem value='Transport'>Transport</SelectItem>
                    <SelectItem value='Communication'>Communication</SelectItem>
                    <SelectItem value='Office Supplies'>Office Supplies</SelectItem>
                    <SelectItem value='Client Entertainment'>Client Entertainment</SelectItem>
                    <SelectItem value='Medical'>Medical</SelectItem>
                    <SelectItem value='Other'>Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='exp-desc'>Description</Label>
                <Textarea id='exp-desc' placeholder='Expense details...' rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type='button' variant='outline' onClick={() => setAddOpen(false)} disabled={adding}>Cancel</Button>
                <Button type='submit' disabled={adding || !form.employeeId || !form.amount || !form.date || !form.category}>
                  {adding ? (<><Loader2 className='size-4 animate-spin' />Submitting...</>) : 'Submit'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <Select value={statusFilter || '_all'} onValueChange={(v) => { setStatusFilter(v === '_all' ? '' : v); setPage(1) }}>
          <SelectTrigger className='w-[150px]'><SelectValue placeholder='All Statuses' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='_all'>All Statuses</SelectItem>
            <SelectItem value='PENDING'>Pending</SelectItem>
            <SelectItem value='APPROVED'>Approved</SelectItem>
            <SelectItem value='REJECTED'>Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter || '_all'} onValueChange={(v) => { setCategoryFilter(v === '_all' ? '' : v); setPage(1) }}>
          <SelectTrigger className='w-[170px]'><SelectValue placeholder='All Categories' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='_all'>All Categories</SelectItem>
            <SelectItem value='Travel'>Travel</SelectItem>
            <SelectItem value='Food'>Food</SelectItem>
            <SelectItem value='Accommodation'>Accommodation</SelectItem>
            <SelectItem value='Transport'>Transport</SelectItem>
            <SelectItem value='Communication'>Communication</SelectItem>
            <SelectItem value='Office Supplies'>Office Supplies</SelectItem>
            <SelectItem value='Other'>Other</SelectItem>
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

      {!loading && !error && expenses.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Receipt className='size-10 text-muted-foreground/50 mb-3' />
            <p className='text-sm font-medium text-muted-foreground'>No expenses found</p>
            <p className='text-xs text-muted-foreground mt-1'>Submit your first expense claim to get started.</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && expenses.length > 0 && (
        <>
          {/* Desktop Table */}
          <Card className='hidden md:block'>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className='w-[200px]'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell>
                        <div>
                          <p className='font-medium'>{employeeFullName(exp.employee)}</p>
                          <p className='text-xs text-muted-foreground'>{exp.employee.department?.name || ''} · {exp.employee.designation?.title || ''}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline'>{exp.category}</Badge>
                      </TableCell>
                      <TableCell className='font-medium'>{formatCurrency(exp.amount)}</TableCell>
                      <TableCell className='text-xs'>{formatDate(exp.date)}</TableCell>
                      <TableCell><Badge variant={expenseStatusVariant(exp.status)}>{exp.status}</Badge></TableCell>
                      <TableCell>
                        {exp.status === 'PENDING' ? (
                          <ExpenseActionButtons expense={exp} onAction={() => fetchExpenses(page)} />
                        ) : (
                          <span className='text-xs text-muted-foreground'>-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Cards */}
          <div className='flex flex-col gap-3 md:hidden'>
            {expenses.map((exp) => (
              <MobileExpenseCard key={exp.id} expense={exp} onAction={() => fetchExpenses(page)} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>Showing {expenses.length} of {total} expenses</p>
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
