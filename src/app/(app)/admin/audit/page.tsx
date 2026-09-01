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
import { AlertCircle, ScrollText, Filter } from 'lucide-react'
import { TableSkeleton } from '@/components/skeletons'

interface AuditLog {
  id: string
  actorName: string
  action: string
  target: string
  createdAt: string
}

interface PaginatedResponse {
  data: AuditLog[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  actions: string[]
}

function formatDateTime(dateStr: string) {
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

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [actions, setActions] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState<string>('ALL')

  const fetchAudit = useCallback(async (p: number, action?: string) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (action && action !== 'ALL') {
        params.set('action', action)
      }
      const data = await apiFetch<PaginatedResponse>(`/api/v1/admin/audit?${params}`)
      setLogs(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
      if (data.actions) setActions(data.actions)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load audit logs'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(1)
    fetchAudit(1, actionFilter)
  }, [actionFilter, fetchAudit])

  useEffect(() => {
    if (actionFilter !== 'ALL') {
      fetchAudit(page, actionFilter)
    }
  }, [page, fetchAudit, actionFilter])

  const handleFilterChange = (value: string) => {
    setActionFilter(value)
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
          <h1 className='text-2xl font-bold tracking-tight'>Audit Activity</h1>
          <p className='text-muted-foreground mt-1'>
            Review actions and events in your organization
          </p>
        </div>
        {actions.length > 0 && (
          <div className='flex items-center gap-2'>
            <Filter className='size-4 text-muted-foreground shrink-0' />
            <Select value={actionFilter} onValueChange={handleFilterChange}>
              <SelectTrigger className='w-[160px]'>
                <SelectValue placeholder='Filter by action' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='ALL'>All Actions</SelectItem>
                {actions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
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

      {!loading && !error && logs.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <ScrollText className='size-10 text-muted-foreground/50 mb-3' />
            <p className='text-sm font-medium text-muted-foreground'>No audit logs found</p>
            <p className='text-xs text-muted-foreground mt-1'>
              Activity events will appear here as actions are performed.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && logs.length > 0 && (
        <>
          {/* Mobile card view */}
          <div className='flex flex-col gap-3 md:hidden'>
            {logs.map((log) => (
              <Card key={log.id} className='overflow-hidden'>
                <CardContent className='p-4 space-y-2'>
                  <div className='flex items-start justify-between gap-2'>
                    <p className='font-medium text-sm truncate'>{log.actorName || '-'}</p>
                    <Badge variant='outline' className='text-[10px] px-1.5 shrink-0'>{log.action}</Badge>
                  </div>
                  {log.target && <p className='text-xs text-muted-foreground truncate'>{log.target}</p>}
                  <p className='text-xs text-muted-foreground'>{formatDateTime(log.createdAt)}</p>
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
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className='font-medium'>{log.actorName || '-'}</TableCell>
                      <TableCell>
                        <Badge variant='outline'>{log.action}</Badge>
                      </TableCell>
                      <TableCell className='text-muted-foreground'>{log.target || '-'}</TableCell>
                      <TableCell className='text-muted-foreground text-xs'>
                        {formatDateTime(log.createdAt)}
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
                Showing {logs.length} of {total} events
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
