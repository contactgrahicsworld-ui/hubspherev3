'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, UserCog, Loader2 } from 'lucide-react'

interface Membership {
  id: string
  userId: string
  userName: string
  userEmail: string
  role: string
  status: string
  createdAt: string
}

interface Role {
  code: string
  name: string
}

interface PaginatedResponse {
  data: Membership[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  roles: Role[]
}

function TableSkeleton() {
  return (
    <>
      <div className='flex flex-col gap-3 md:hidden'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className='p-4 space-y-3'>
            <Skeleton className='h-4 w-28' />
            <Skeleton className='h-3 w-44' />
            <Skeleton className='h-8 w-28' />
          </CardContent></Card>
        ))}
      </div>
      <Card className='hidden md:block'>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableHead key={i}><Skeleton className='h-4 w-24' /></TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className='h-4 w-full' /></TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}

function statusVariant(status: string) {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'default' as const
    case 'inactive':
    case 'suspended':
      return 'destructive' as const
    case 'pending':
      return 'secondary' as const
    default:
      return 'outline' as const
  }
}

function formatDate(dateStr: string) {
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

export default function AdminMembershipsPage() {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [changingRole, setChangingRole] = useState<string | null>(null)

  const fetchMemberships = useCallback(async (p: number) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      const data = await apiFetch<PaginatedResponse>(`/api/v1/admin/memberships?${params}`)
      setMemberships(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
      if (data.roles) setRoles(data.roles)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load memberships'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMemberships(page)
  }, [page, fetchMemberships])

  const handleRoleChange = async (membershipId: string, newRole: string) => {
    try {
      setChangingRole(membershipId)
      await apiFetch(`/api/v1/admin/memberships/${membershipId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      })
      toast.success('Role updated successfully')
      fetchMemberships(page)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update role'
      toast.error(message)
    } finally {
      setChangingRole(null)
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
      {/* Header */}
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Membership Management</h1>
        <p className='text-muted-foreground mt-1'>
          Manage member roles and statuses in your organization
        </p>
      </div>

      {loading && <TableSkeleton />}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 text-destructive shrink-0' />
            <p className='text-sm text-destructive'>{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && memberships.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <UserCog className='size-10 text-muted-foreground/50 mb-3' />
            <p className='text-sm font-medium text-muted-foreground'>No memberships found</p>
            <p className='text-xs text-muted-foreground mt-1'>
              Memberships will appear here once users join your organization.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && memberships.length > 0 && (
        <>
          {/* Mobile card view */}
          <div className='flex flex-col gap-3 md:hidden'>
            {memberships.map((m) => (
              <Card key={m.id} className='overflow-hidden'>
                <CardContent className='p-4 space-y-3'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='min-w-0'>
                      <p className='font-medium text-sm truncate'>{m.userName || '-'}</p>
                      <p className='text-xs text-muted-foreground truncate'>{m.userEmail}</p>
                    </div>
                    <Badge variant={statusVariant(m.status)} className='text-[10px] px-1.5 shrink-0'>{m.status}</Badge>
                  </div>
                  <div className='flex items-center justify-between gap-3'>
                    <div className='flex items-center gap-2'>
                      {changingRole === m.id ? (
                        <Loader2 className='size-4 animate-spin text-muted-foreground' />
                      ) : (
                        <Select
                          value={m.role}
                          onValueChange={(val) => handleRoleChange(m.id, val)}
                        >
                          <SelectTrigger size='sm' className='w-[130px] h-8 text-xs'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.length > 0
                              ? roles.map((r) => (
                                  <SelectItem key={r.code} value={r.code}>
                                    {r.name}
                                  </SelectItem>
                                ))
                              : ['ADMIN', 'MEMBER', 'VIEWER'].map((r) => (
                                  <SelectItem key={r} value={r}>{r}</SelectItem>
                                ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <span className='text-xs text-muted-foreground'>{formatDate(m.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Desktop table view */}
          <Card className='hidden md:block'>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberships.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className='font-medium'>{m.userName || '-'}</TableCell>
                      <TableCell className='text-muted-foreground'>{m.userEmail}</TableCell>
                      <TableCell>
                        <div className='flex items-center gap-2'>
                          {changingRole === m.id ? (
                            <Loader2 className='size-4 animate-spin text-muted-foreground' />
                          ) : (
                            <Select
                              value={m.role}
                              onValueChange={(val) => handleRoleChange(m.id, val)}
                            >
                              <SelectTrigger size='sm' className='w-[120px]'>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {roles.length > 0
                                  ? roles.map((r) => (
                                      <SelectItem key={r.code} value={r.code}>
                                        {r.name}
                                      </SelectItem>
                                    ))
                                  : ['ADMIN', 'MEMBER', 'VIEWER'].map((r) => (
                                      <SelectItem key={r} value={r}>
                                        {r}
                                      </SelectItem>
                                    ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
                      </TableCell>
                      <TableCell className='text-muted-foreground text-xs'>
                        {formatDate(m.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>
                Showing {memberships.length} of {total} memberships
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
