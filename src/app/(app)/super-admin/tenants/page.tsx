'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Plus, Eye, Pencil, Building2, AlertCircle, Globe, Hash } from 'lucide-react'
import { TableSkeleton } from '@/components/skeletons'

interface Tenant {
  id: string
  name: string
  slug: string
  domain: string | null
  status: string
  plan: string | null
  userCount: number
  createdAt: string
}

interface PaginatedResponse {
  data: Tenant[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

function statusVariant(status: string) {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'default' as const
    case 'inactive':
    case 'suspended':
      return 'destructive' as const
    default:
      return 'secondary' as const
  }
}

export default function TenantManagement() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({ name: '', slug: '', domain: '' })

  const fetchTenants = useCallback(async (p: number) => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiFetch<PaginatedResponse>(`/api/v1/super-admin/tenants?page=${p}&limit=20`)
      setTenants(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load tenants'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTenants(page)
  }, [page, fetchTenants])

  const handleCreateTenant = async () => {
    if (!formData.name.trim() || !formData.slug.trim()) {
      toast.error('Name and slug are required')
      return
    }
    try {
      setCreating(true)
      await apiFetch('/api/v1/super-admin/tenants', {
        method: 'POST',
        body: JSON.stringify(formData),
      })
      toast.success('Tenant created successfully')
      setDialogOpen(false)
      setFormData({ name: '', slug: '', domain: '' })
      fetchTenants(1)
      setPage(1)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create tenant'
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const renderPageNumbers = () => {
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

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Tenants</h1>
          <p className='text-muted-foreground mt-1'>Manage all platform tenants</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size='sm'>
              <Plus className='size-4' />
              Create Tenant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Tenant</DialogTitle>
              <DialogDescription>
                Add a new tenant to the platform. The slug will be used as a unique identifier.
              </DialogDescription>
            </DialogHeader>
            <div className='grid gap-4 py-2'>
              <div className='grid gap-2'>
                <Label htmlFor='tenant-name'>Name</Label>
                <Input
                  id='tenant-name'
                  placeholder='Acme Corp'
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='tenant-slug'>Slug</Label>
                <Input
                  id='tenant-slug'
                  placeholder='acme-corp'
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='tenant-domain'>Domain (optional)</Label>
                <Input
                  id='tenant-domain'
                  placeholder='acme.example.com'
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant='outline' onClick={() => setDialogOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button onClick={handleCreateTenant} disabled={creating}>
                {creating ? 'Creating...' : 'Create Tenant'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading && <TableSkeleton columns={5} />}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 text-destructive shrink-0' />
            <p className='text-sm text-destructive'>{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && tenants.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Building2 className='size-10 text-muted-foreground/50 mb-3' />
            <p className='text-sm font-medium text-muted-foreground'>No tenants found</p>
            <p className='text-xs text-muted-foreground mt-1'>
              Create your first tenant to get started.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && tenants.length > 0 && (
        <>
          {/* Desktop Table */}
          <Card className='hidden md:block'>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className='text-right'>Users</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className='font-medium'>{tenant.name}</TableCell>
                      <TableCell className='text-muted-foreground font-mono text-xs'>
                        {tenant.slug}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(tenant.status)}>
                          {tenant.status}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {tenant.plan || '-'}
                      </TableCell>
                      <TableCell className='text-right'>{tenant.userCount}</TableCell>
                      <TableCell className='text-muted-foreground'>
                        {formatDate(tenant.createdAt)}
                      </TableCell>
                      <TableCell className='text-right'>
                        <div className='flex items-center justify-end gap-1'>
                          <Button variant='ghost' size='icon' className='size-8' aria-label={`View ${tenant.name}`}>
                            <Eye className='size-4' />
                          </Button>
                          <Button variant='ghost' size='icon' className='size-8' aria-label={`Edit ${tenant.name}`}>
                            <Pencil className='size-4' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Cards */}
          <div className='block md:hidden space-y-3'>
            {tenants.map((tenant) => (
              <Card key={tenant.id}>
                <CardContent className='p-4'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='min-w-0'>
                      <p className='font-medium truncate'>{tenant.name}</p>
                      <div className='flex items-center gap-1 mt-0.5'>
                        <Hash className='size-3 text-muted-foreground shrink-0' />
                        <p className='text-xs text-muted-foreground font-mono truncate'>
                          {tenant.slug}
                        </p>
                      </div>
                    </div>
                    <Badge variant={statusVariant(tenant.status)}>{tenant.status}</Badge>
                  </div>
                  <div className='flex items-center gap-4 mt-3 text-xs text-muted-foreground'>
                    <span>Plan: {tenant.plan || '-'}</span>
                    <span>Users: {tenant.userCount}</span>
                  </div>
                  <div className='flex items-center justify-between mt-3'>
                    <span className='text-xs text-muted-foreground'>
                      {formatDate(tenant.createdAt)}
                    </span>
                    <div className='flex items-center gap-1'>
                      <Button variant='ghost' size='sm' className='h-7 text-xs'>
                        <Eye className='size-3 mr-1' />View
                      </Button>
                      <Button variant='ghost' size='sm' className='h-7 text-xs'>
                        <Pencil className='size-3 mr-1' />Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>
                Showing {tenants.length} of {total} tenants
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href='#'
                      onClick={(e) => {
                        e.preventDefault()
                        if (page > 1) setPage(page - 1)
                      }}
                      aria-disabled={page <= 1}
                      className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                  {renderPageNumbers().map((p) => (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href='#'
                        isActive={p === page}
                        onClick={(e) => {
                          e.preventDefault()
                          setPage(p)
                        }}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href='#'
                      onClick={(e) => {
                        e.preventDefault()
                        if (page < totalPages) setPage(page + 1)
                      }}
                      aria-disabled={page >= totalPages}
                      className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                    />
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
