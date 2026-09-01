'use client'

import { useEffect, useState, useCallback, type FormEvent } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
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
import { Users, AlertCircle, UserPlus, Loader2, Mail } from 'lucide-react'
import { TableSkeleton } from '@/components/skeletons'

interface User {
  id: string
  name: string
  email: string
  role: string
  status: string
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

function MobileUserCard({ user }: { user: User }) {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <p className='font-medium truncate'>{user.name || '-'}</p>
            <p className='text-sm text-muted-foreground truncate'>{user.email}</p>
          </div>
          <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
        </div>
        <div className='mt-3 flex items-center gap-3 text-xs text-muted-foreground'>
          <Badge variant='outline'>{user.role}</Badge>
          <span>Joined {formatDate(user.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('MEMBER')
  const [inviting, setInviting] = useState(false)

  const fetchUsers = useCallback(async (p: number) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      const data = await apiFetch<PaginatedResponse>(`/api/v1/admin/users?${params}`)
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
    fetchUsers(page)
  }, [page, fetchUsers])

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    try {
      setInviting(true)
      await apiFetch('/api/v1/admin/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim(),
          role: inviteRole,
        }),
      })
      toast.success(`Invitation sent to ${inviteEmail.trim()}`)
      setDialogOpen(false)
      setInviteEmail('')
      setInviteName('')
      setInviteRole('MEMBER')
      fetchUsers(page)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to invite user'
      toast.error(message)
    } finally {
      setInviting(false)
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
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>User Management</h1>
          <p className='text-muted-foreground mt-1'>
            Manage members in your organization
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className='min-w-[120px]'>
              <UserPlus className='size-4' />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite User</DialogTitle>
              <DialogDescription>
                Send an invitation to add a new member to your organization.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInvite} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='invite-email'>Email</Label>
                <div className='relative'>
                  <Mail className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
                  <Input
                    id='invite-email'
                    type='email'
                    placeholder='user@example.com'
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className='pl-9'
                    required
                    aria-required='true'
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='invite-name'>Name</Label>
                <Input
                  id='invite-name'
                  placeholder='Full name'
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='invite-role'>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id='invite-role' className='w-full'>
                    <SelectValue placeholder='Select a role' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='ADMIN'>Admin</SelectItem>
                    <SelectItem value='MEMBER'>Member</SelectItem>
                    <SelectItem value='VIEWER'>Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setDialogOpen(false)}
                  disabled={inviting}
                >
                  Cancel
                </Button>
                <Button type='submit' disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? (
                    <>
                      <Loader2 className='size-4 animate-spin' />
                      Inviting...
                    </>
                  ) : (
                    'Send Invitation'
                  )}
                </Button>
              </DialogFooter>
            </form>
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

      {!loading && !error && users.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Users className='size-10 text-muted-foreground/50 mb-3' />
            <p className='text-sm font-medium text-muted-foreground'>No users found</p>
            <p className='text-xs text-muted-foreground mt-1'>
              Invite your first team member to get started.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && users.length > 0 && (
        <>
          {/* Desktop Table */}
          <Card className='hidden md:block'>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className='font-medium'>{user.name || '-'}</TableCell>
                      <TableCell className='text-muted-foreground'>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant='outline'>{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
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

          {/* Mobile Cards */}
          <div className='flex flex-col gap-3 md:hidden'>
            {users.map((user) => (
              <MobileUserCard key={user.id} user={user} />
            ))}
          </div>

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
