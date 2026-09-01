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
  IdCard, AlertCircle, Plus, Loader2, Search,
} from 'lucide-react'
import { TableSkeleton } from '@/components/skeletons'

// ============================================
// Types
// ============================================

interface Designation {
  id: string
  title: string
  description: string | null
  departmentId: string | null
  status: string
  department: { id: string; name: string } | null
  createdAt: string
}

interface Department {
  id: string
  name: string
}

interface PaginatedResponse {
  data: Designation[]
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


function MobileDesigCard({ desig }: { desig: Designation }) {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <p className='font-medium truncate'>{desig.title}</p>
            {desig.department && <p className='text-xs text-muted-foreground'>{desig.department.name}</p>}
          </div>
          <Badge variant={statusVariant(desig.status)}>{desig.status}</Badge>
        </div>
        {desig.description && (
          <p className='mt-2 text-xs text-muted-foreground line-clamp-2'>{desig.description}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page
// ============================================

export default function DesignationsPage() {
  const [designations, setDesignations] = useState<Designation[]>([])
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
  const [form, setForm] = useState({ title: '', description: '', departmentId: '', status: 'ACTIVE' })
  const [departments, setDepartments] = useState<Department[]>([])

  const fetchDesignations = useCallback(async (p: number) => {
    try {
      setLoading(true)
      setError(null)
      setDbUnavailable(false)
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (search) params.set('search', search)
      const data = await apiFetch<PaginatedResponse>(`/api/v1/hrms/designations?${params}`)
      setDesignations(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load designations'
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

  const fetchDepts = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: Department[] }>('/api/v1/hrms/departments?limit=100')
      setDepartments(res.data)
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => { fetchDesignations(page) }, [page, fetchDesignations])
  useEffect(() => { if (addOpen) fetchDepts() }, [addOpen, fetchDepts])

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    try {
      setAdding(true)
      const body: Record<string, unknown> = { title: form.title.trim(), status: form.status }
      if (form.description.trim()) body.description = form.description.trim()
      if (form.departmentId) body.departmentId = form.departmentId
      await apiFetch('/api/v1/hrms/designations', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      toast.success('Designation created successfully')
      setAddOpen(false)
      setForm({ title: '', description: '', departmentId: '', status: 'ACTIVE' })
      fetchDesignations(1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create designation'
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
          <h1 className='text-2xl font-bold tracking-tight'>Designations</h1>
          <p className='text-muted-foreground mt-1'>Job titles and role definitions</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className='min-w-[160px]'><Plus className='size-4' />Add Designation</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Designation</DialogTitle>
              <DialogDescription>Create a new job designation.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='desig-title'>Title *</Label>
                <Input id='desig-title' placeholder='Software Engineer' value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='desig-dept'>Department</Label>
                  <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                    <SelectTrigger id='desig-dept'><SelectValue placeholder='Any department' /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='desig-status'>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger id='desig-status'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='ACTIVE'>Active</SelectItem>
                      <SelectItem value='INACTIVE'>Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='desig-desc'>Description</Label>
                <Textarea id='desig-desc' placeholder='Role description...' rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type='button' variant='outline' onClick={() => setAddOpen(false)} disabled={adding}>Cancel</Button>
                <Button type='submit' disabled={adding || !form.title.trim()}>
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
        <Input placeholder='Search designations...' value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className='pl-9' />
      </form>

      {loading && <TableSkeleton columns={4} />}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 text-destructive shrink-0' />
            <p className='text-sm text-destructive'>{dbUnavailable ? 'Service temporarily unavailable.' : error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && designations.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <IdCard className='size-10 text-muted-foreground/50 mb-3' />
            <p className='text-sm font-medium text-muted-foreground'>No designations found</p>
            <p className='text-xs text-muted-foreground mt-1'>Create your first designation to define job roles.</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && designations.length > 0 && (
        <>
          <Card className='hidden md:block'>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {designations.map((desig) => (
                    <TableRow key={desig.id}>
                      <TableCell>
                        <div>
                          <p className='font-medium'>{desig.title}</p>
                          {desig.description && <p className='text-xs text-muted-foreground line-clamp-1'>{desig.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{desig.department?.name || '-'}</TableCell>
                      <TableCell><Badge variant={statusVariant(desig.status)}>{desig.status}</Badge></TableCell>
                      <TableCell className='text-xs text-muted-foreground'>
                        {new Date(desig.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className='flex flex-col gap-3 md:hidden'>
            {designations.map((desig) => (
              <MobileDesigCard key={desig.id} desig={desig} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>Showing {designations.length} of {total} designations</p>
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
