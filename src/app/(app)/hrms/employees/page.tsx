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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import {
  UsersRound,
  AlertCircle,
  UserPlus,
  Loader2,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Archive,
} from 'lucide-react'
import { TableSkeleton } from '@/components/skeletons'

// ============================================
// Types
// ============================================

interface Department {
  id: string
  name: string
}

interface Designation {
  id: string
  title: string
}

interface Employee {
  id: string
  userId: string
  employeeId: string
  firstName: string
  lastName: string | null
  email: string | null
  mobile: string | null
  employmentStatus: string
  workLocation: string | null
  basicSalary: number | null
  salaryCurrency: string | null
  joiningDate: string | null
  department: Department | null
  designation: Designation | null
  createdAt: string
}

interface SimpleUser {
  id: string
  name: string
  email: string
}

interface PaginatedResponse {
  data: Employee[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ============================================
// Helpers
// ============================================

function formatDate(dateStr: string | null) {
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

function formatCurrency(amount: number | null, currency: string | null) {
  if (amount == null) return '-'
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₹'
  return `${sym}${amount.toLocaleString()}`
}

function statusVariant(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'default' as const
    case 'INACTIVE':
    case 'TERMINATED':
      return 'destructive' as const
    case 'PROBATION':
      return 'secondary' as const
    default:
      return 'outline' as const
  }
}

function employeeFullName(emp: Employee) {
  return [emp.firstName, emp.lastName].filter(Boolean).join(' ') || '-'
}


function MobileEmployeeCard({ emp }: { emp: Employee }) {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <p className='font-medium truncate'>{employeeFullName(emp)}</p>
            <p className='text-xs text-muted-foreground truncate'>Emp #{emp.employeeId}</p>
          </div>
          <Badge variant={statusVariant(emp.employmentStatus)}>{emp.employmentStatus}</Badge>
        </div>
        <div className='mt-3 space-y-1 text-xs text-muted-foreground'>
          {emp.email && <p className='truncate'>{emp.email}</p>}
          <div className='flex items-center gap-2'>
            {emp.department && <Badge variant='outline'>{emp.department.name}</Badge>}
            {emp.designation && <Badge variant='outline'>{emp.designation.title}</Badge>}
          </div>
          <p>Joined {formatDate(emp.joiningDate)}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function renderPageNumbers(page: number, totalPages: number) {
  const pages: number[] = []
  const maxVisible = 5
  let start = Math.max(1, page - Math.floor(maxVisible / 2))
  const end = Math.min(totalPages, start + maxVisible - 1)
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1)
  }
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  return pages
}

// ============================================
// Main Page
// ============================================

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dbUnavailable, setDbUnavailable] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Add dialog
  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    userId: '',
    employeeId: '',
    departmentId: '',
    designationId: '',
    employmentStatus: 'ACTIVE',
    workLocation: '',
    basicSalary: '',
    joiningDate: '',
  })

  // Reference data
  const [departments, setDepartments] = useState<Department[]>([])
  const [designations, setDesignations] = useState<Designation[]>([])
  const [users, setUsers] = useState<SimpleUser[]>([])

  // Archive
  const [archivingId, setArchivingId] = useState<string | null>(null)

  const fetchEmployees = useCallback(async (p: number) => {
    try {
      setLoading(true)
      setError(null)
      setDbUnavailable(false)
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (search) params.set('search', search)
      if (statusFilter) params.set('employmentStatus', statusFilter)
      const data = await apiFetch<PaginatedResponse>(`/api/v1/hrms/employees?${params}`)
      setEmployees(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load employees'
      if (msg.includes('Database unavailable') || msg.includes('503')) {
        setDbUnavailable(true)
        setError('Database is currently unavailable.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  const fetchReferenceData = useCallback(async () => {
    try {
      const [deptRes, desigRes, userRes] = await Promise.all([
        apiFetch<{ data: Department[] }>('/api/v1/hrms/departments?limit=100'),
        apiFetch<{ data: Designation[] }>('/api/v1/hrms/designations?limit=100'),
        apiFetch<{ data: SimpleUser[] }>('/api/v1/admin/users?limit=100'),
      ])
      setDepartments(deptRes.data)
      setDesignations(desigRes.data)
      setUsers(userRes.data)
    } catch {
      // Reference data fetch failure is non-critical
    }
  }, [])

  useEffect(() => {
    fetchEmployees(page)
  }, [page, fetchEmployees])

  useEffect(() => {
    if (addOpen) fetchReferenceData()
  }, [addOpen, fetchReferenceData])

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.firstName.trim() || !form.employeeId.trim() || !form.userId) return
    try {
      setAdding(true)
      const body: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        employeeId: form.employeeId.trim(),
        userId: form.userId,
        employmentStatus: form.employmentStatus,
      }
      if (form.lastName.trim()) body.lastName = form.lastName.trim()
      if (form.email.trim()) body.email = form.email.trim()
      if (form.mobile.trim()) body.mobile = form.mobile.trim()
      if (form.departmentId) body.departmentId = form.departmentId
      if (form.designationId) body.designationId = form.designationId
      if (form.workLocation.trim()) body.workLocation = form.workLocation.trim()
      if (form.basicSalary) body.basicSalary = parseFloat(form.basicSalary)
      if (form.joiningDate) body.joiningDate = new Date(form.joiningDate).toISOString()

      await apiFetch('/api/v1/hrms/employees', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      toast.success('Employee added successfully')
      setAddOpen(false)
      setForm({
        firstName: '', lastName: '', email: '', mobile: '', userId: '', employeeId: '',
        departmentId: '', designationId: '', employmentStatus: 'ACTIVE', workLocation: '', basicSalary: '', joiningDate: '',
      })
      fetchEmployees(1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add employee'
      toast.error(msg)
    } finally {
      setAdding(false)
    }
  }

  const handleArchive = async (id: string) => {
    try {
      setArchivingId(id)
      await apiFetch(`/api/v1/hrms/employees/${id}`, { method: 'DELETE' })
      toast.success('Employee archived successfully')
      fetchEmployees(page)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to archive employee'
      toast.error(msg)
    } finally {
      setArchivingId(null)
    }
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Employees</h1>
          <p className='text-muted-foreground mt-1'>Manage your organization&apos;s workforce</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className='min-w-[130px]'>
              <UserPlus className='size-4' />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className='max-h-[90vh] overflow-y-auto'>
            <DialogHeader>
              <DialogTitle>Add Employee</DialogTitle>
              <DialogDescription>
                Create a new employee record in the system.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className='space-y-4'>
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='first-name'>First Name *</Label>
                  <Input id='first-name' placeholder='John' value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='last-name'>Last Name</Label>
                  <Input id='last-name' placeholder='Doe' value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='user-select'>User Account *</Label>
                <Select value={form.userId} onValueChange={(v) => setForm({ ...form, userId: v })}>
                  <SelectTrigger id='user-select'><SelectValue placeholder='Select a user' /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='emp-id'>Employee ID *</Label>
                  <Input id='emp-id' placeholder='EMP-001' value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='emp-email'>Email</Label>
                  <Input id='emp-email' type='email' placeholder='john@company.com' value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='emp-mobile'>Mobile</Label>
                  <Input id='emp-mobile' placeholder='+91 9876543210' value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='emp-status'>Employment Status</Label>
                  <Select value={form.employmentStatus} onValueChange={(v) => setForm({ ...form, employmentStatus: v })}>
                    <SelectTrigger id='emp-status'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='ACTIVE'>Active</SelectItem>
                      <SelectItem value='PROBATION'>Probation</SelectItem>
                      <SelectItem value='INACTIVE'>Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='emp-dept'>Department</Label>
                  <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                    <SelectTrigger id='emp-dept'><SelectValue placeholder='Select department' /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='emp-designation'>Designation</Label>
                  <Select value={form.designationId} onValueChange={(v) => setForm({ ...form, designationId: v })}>
                    <SelectTrigger id='emp-designation'><SelectValue placeholder='Select designation' /></SelectTrigger>
                    <SelectContent>
                      {designations.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='emp-joining'>Joining Date</Label>
                  <Input id='emp-joining' type='date' value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='emp-salary'>Basic Salary</Label>
                  <Input id='emp-salary' type='number' min='0' step='0.01' placeholder='50000' value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} />
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='emp-location'>Work Location</Label>
                <Input id='emp-location' placeholder='Office / Remote / Hybrid' value={form.workLocation} onChange={(e) => setForm({ ...form, workLocation: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type='button' variant='outline' onClick={() => setAddOpen(false)} disabled={adding}>Cancel</Button>
                <Button type='submit' disabled={adding || !form.firstName.trim() || !form.employeeId.trim() || !form.userId}>
                  {adding ? (<><Loader2 className='size-4 animate-spin' />Adding...</>) : 'Add Employee'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + Filters */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <form onSubmit={handleSearch} className='relative flex-1 max-w-sm'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
          <Input placeholder='Search employees...' value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className='pl-9' />
        </form>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === '_all' ? '' : v); setPage(1) }}>
          <SelectTrigger className='w-[160px]'><SelectValue placeholder='All Statuses' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='_all'>All Statuses</SelectItem>
            <SelectItem value='ACTIVE'>Active</SelectItem>
            <SelectItem value='PROBATION'>Probation</SelectItem>
            <SelectItem value='INACTIVE'>Inactive</SelectItem>
            <SelectItem value='TERMINATED'>Terminated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {loading && <TableSkeleton columns={6} />}

      {/* Error */}
      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 text-destructive shrink-0' />
            <p className='text-sm text-destructive'>{dbUnavailable ? 'Service temporarily unavailable. Please try again later.' : error}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!loading && !error && employees.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <UsersRound className='size-10 text-muted-foreground/50 mb-3' />
            <p className='text-sm font-medium text-muted-foreground'>No employees found</p>
            <p className='text-xs text-muted-foreground mt-1'>Add your first employee to get started.</p>
          </CardContent>
        </Card>
      )}

      {/* Data */}
      {!loading && !error && employees.length > 0 && (
        <>
          {/* Desktop Table */}
          <Card className='hidden md:block'>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Emp ID</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead className='w-[50px]' />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>
                        <div>
                          <p className='font-medium'>{employeeFullName(emp)}</p>
                          {emp.email && <p className='text-xs text-muted-foreground'>{emp.email}</p>}
                        </div>
                      </TableCell>
                      <TableCell className='font-mono text-xs'>{emp.employeeId}</TableCell>
                      <TableCell>{emp.department?.name || '-'}</TableCell>
                      <TableCell>{emp.designation?.title || '-'}</TableCell>
                      <TableCell><Badge variant={statusVariant(emp.employmentStatus)}>{emp.employmentStatus}</Badge></TableCell>
                      <TableCell>{formatCurrency(emp.basicSalary, emp.salaryCurrency)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='icon' className='size-8'>
                              <MoreVertical className='size-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className='text-destructive'>
                                  <Trash2 className='size-4' />Archive
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Archive Employee</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to archive {employeeFullName(emp)}? This action can be reversed by an administrator.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleArchive(emp.id)} disabled={archivingId === emp.id}>
                                    {archivingId === emp.id ? 'Archiving...' : 'Archive'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Cards */}
          <div className='flex flex-col gap-3 md:hidden'>
            {employees.map((emp) => (
              <MobileEmployeeCard key={emp.id} emp={emp} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>
                Showing {employees.length} of {total} employees
              </p>
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
