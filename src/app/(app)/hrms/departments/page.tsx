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
  Network, AlertCircle, Plus, Loader2, Search,
} from 'lucide-react'
import { TableSkeleton } from '@/components/skeletons'

// ============================================
// Types
// ============================================

interface Department {
  id: string
  name: string
  code: string | null
  description: string | null
  status: string
  headId: string | null
  employeeCount: number
  head: { id: string; name: string; email: string } | null
  createdAt: string
}

interface PaginatedResponse {
  data: Department[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

// ============================================
// Helpers
// ============================================

function statusVariant(status: string) {
  switch (status) {
    case 'ACTIVE': return 'default' as const
    case 'INACTIVE': return 'destructive' as const
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


function MobileDeptCard({ dept }: { dept: Department }) {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <p className='font-medium truncate'>{dept.name}</p>
            {dept.code && <p className='text-xs text-muted-foreground'>{dept.code}</p>}
          </div>
          <Badge variant={statusVariant(dept.status)}>{dept.status}</Badge>
        </div>
        {dept.head && (
          <p className='mt-2 text-xs text-muted-foreground'>Head: {dept.head.name}</p>
        )}
        <div className='mt-2 flex items-center gap-2 text-xs text-muted-foreground'>
          <Badge variant='outline'>{dept.employeeCount} employee{dept.employeeCount !== 1 ? 's' : ''}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page
// ============================================

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dbUnavailable, setDbUnavailable] = useState(false)

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', description: '', status: 'ACTIVE' })

  const fetchDepts = useCallback(async (p: number) => {
    try {
      setLoading(true)
      setError(null)
      setDbUnavailable(false)
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (search) params.set('search', search)
      const data = await apiFetch<PaginatedResponse>(`/api/v1/hrms/departments?${params}`)
      setDepartments(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load departments'
      if (msg.includes('Database unavailable') || msg.includes('503')) {
        setDbUnavailable(true)
        setError('Database is currently unavailable.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchDepts(page) }, [page, fetchDepts])

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    try {
      setAdding(true)
      const body: Record<string, unknown> = { name: form.name.trim(), status: form.status }
      if (form.code.trim()) body.code = form.code.trim()
      if (form.description.trim()) body.description = form.description.trim()
      await apiFetch('/api/v1/hrms/departments', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      toast.success('Department created successfully')
      setAddOpen(false)
      setForm({ name: '', code: '', description: '', status: 'ACTIVE' })
      fetchDepts(1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create department'
      toast.error(msg)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Departments</h1>
          <p className='text-muted-foreground mt-1'>Organizational structure and team groupings</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className='min-w-[150px]'><Plus className='size-4' />Add Department</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Department</DialogTitle>
              <DialogDescription>Create a new department in your organization.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='dept-name'>Name *</Label>
                <Input id='dept-name' placeholder='Engineering' value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='dept-code'>Code</Label>
                  <Input id='dept-code' placeholder='ENG' value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='dept-status'>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger id='dept-status'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='ACTIVE'>Active</SelectItem>
                      <SelectItem value='INACTIVE'>Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='dept-desc'>Description</Label>
                <Textarea id='dept-desc' placeholder='Brief description...' rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type='button' variant='outline' onClick={() => setAddOpen(false)} disabled={adding}>Cancel</Button>
                <Button type='submit' disabled={adding || !form.name.trim()}>
                  {adding ? (<><Loader2 className='size-4 animate-spin' />Creating...</>) : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className='relative max-w-sm'>
        <Search className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
        <Input placeholder='Search departments...' value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className='pl-9' />
      </form>

      {loading && <TableSkeleton columns={5} />}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 text-destructive shrink-0' />
            <p className='text-sm text-destructive'>{dbUnavailable ? 'Service temporarily unavailable.' : error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && departments.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Network className='size-10 text-muted-foreground/50 mb-3' />
            <p className='text-sm font-medium text-muted-foreground'>No departments found</p>
            <p className='text-xs text-muted-foreground mt-1'>Create your first department to organize teams.</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && departments.length > 0 && (
        <>
          <Card className='hidden md:block'>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Head</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className='font-medium'>{dept.name}</TableCell>
                      <TableCell className='font-mono text-xs'>{dept.code || '-'}</TableCell>
                      <TableCell>{dept.head?.name || '-'}</TableCell>
                      <TableCell><Badge variant='outline'>{dept.employeeCount}</Badge></TableCell>
                      <TableCell><Badge variant={statusVariant(dept.status)}>{dept.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className='flex flex-col gap-3 md:hidden'>
            {departments.map((dept) => (
              <MobileDeptCard key={dept.id} dept={dept} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>Showing {departments.length} of {total} departments</p>
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
