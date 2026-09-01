'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
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
import { Users, AlertCircle, Search } from 'lucide-react'
import { TableSkeleton } from '@/components/skeletons'

interface User {
  id: string
  name: string
  email: string
  status: string
  isSuperAdmin: boolean
  lastLoginAt: string | null
  createdAt: string
}

interface PaginatedResponse {
  data: User[]
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

export default function UserOverview() {
  const [users, setUsers] = useState<User[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchDebounce, setSearchDebounce] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchUsers = useCallback(async (p: number, query: string) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (query.trim()) {
        params.set('search', query.trim())
      }
      const data = await apiFetch<PaginatedResponse>(`/api/v1/super-admin/users?${params}`)
      setUsers(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load users'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(1)
    fetchUsers(1, searchDebounce)
  }, [searchDebounce, fetchUsers])

  useEffect(() => {
    if (searchDebounce) {
      fetchUsers(page, searchDebounce)
    }
  }, [page, fetchUsers, searchDebounce])

  const formatDate = (dateStr: string | null) => {
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

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return '-'
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
          <h1 className='text-2xl font-bold tracking-tight'>Users</h1>
          <p className='text-muted-foreground mt-1'>Overview of all users across tenants</p>
        </div>
        <div className='relative w-full sm:w-72'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
          <Input
            placeholder='Search by name or email...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-9'
            aria-label='Search users'
          />
        </div>
      </div>

      {loading && <TableSkeleton columns={4} />}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 text-destructive shrink-0' />
            <p className='text-sm text-destructive'>{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && users.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Users className='size-10 text-muted-foreground/50 mb-3' />
            <p className='text-sm font-medium text-muted-foreground'>No users found</p>
            <p className='text-xs text-muted-foreground mt-1'>
              {searchDebounce
                ? 'Try adjusting your search query.'
                : 'Users will appear here once they register on the platform.'}
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && users.length > 0 && (
        <>
          {/* Mobile card view */}
          <div className='flex flex-col gap-3 md:hidden'>
            {users.map((user) => (
              <Card key={user.id} className='overflow-hidden'>
                <CardContent className='p-4 space-y-2'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='min-w-0'>
                      <p className='font-medium text-sm truncate'>{user.name || '-'}</p>
                      <p className='text-xs text-muted-foreground truncate'>{user.email}</p>
                    </div>
                    <div className='flex items-center gap-1.5 shrink-0'>
                      {user.isSuperAdmin && <Badge variant='default' className='text-[10px] px-1.5'>SA</Badge>}
                      <Badge variant={statusVariant(user.status)} className='text-[10px] px-1.5'>{user.status}</Badge>
                    </div>
                  </div>
                  <div className='flex items-center justify-between text-xs text-muted-foreground'>
                    <span>Login: {formatDateTime(user.lastLoginAt)}</span>
                    <span>Created: {formatDate(user.createdAt)}</span>
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
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Super Admin</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className='font-medium'>{user.name || '-'}</TableCell>
                      <TableCell className='text-muted-foreground'>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(user.status)}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.isSuperAdmin ? (
                          <Badge variant='default'>Yes</Badge>
                        ) : (
                          <span className='text-muted-foreground text-xs'>No</span>
                        )}
                      </TableCell>
                      <TableCell className='text-muted-foreground text-xs'>
                        {formatDateTime(user.lastLoginAt)}
                      </TableCell>
                      <TableCell className='text-muted-foreground text-xs'>
                        {formatDate(user.createdAt)}
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
                Showing {users.length} of {total} users
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
