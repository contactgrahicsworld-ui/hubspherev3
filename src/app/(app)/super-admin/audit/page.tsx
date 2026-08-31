'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { ScrollText, AlertCircle } from 'lucide-react'

interface AuditLog {
  id: string
  actorName: string | null
  actorEmail: string | null
  action: string
  targetType: string | null
  targetId: string | null
  ipAddress: string | null
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
}

function TableSkeleton() {
  return (
    <>
      <div className='flex flex-col gap-3 md:hidden'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className='p-4 space-y-3'>
            <Skeleton className='h-4 w-28' />
            <Skeleton className='h-5 w-20' />
            <Skeleton className='h-3 w-40' />
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

function actionVariant(action: string) {
  const a = action?.toLowerCase() || ''
  if (a.includes('create') || a.includes('add')) return 'default' as const
  if (a.includes('delete') || a.includes('remove')) return 'destructive' as const
  if (a.includes('update') || a.includes('edit') || a.includes('change')) return 'secondary' as const
  return 'outline' as const
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState<string>('all')

  const fetchLogs = useCallback(async (p: number, action: string) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (action && action !== 'all') {
        params.set('action', action)
      }
      const data = await apiFetch<PaginatedResponse>(`/api/v1/super-admin/audit?${params}`)
      setLogs(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
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
    fetchLogs(1, actionFilter)
  }, [actionFilter, fetchLogs])

  useEffect(() => {
    fetchLogs(page, actionFilter)
  }, [page, fetchLogs, actionFilter])

  const formatTimestamp = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
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

  const actionOptions = [
    { value: 'all', label: 'All Actions' },
    { value: 'CREATE', label: 'Create' },
    { value: 'UPDATE', label: 'Update' },
    { value: 'DELETE', label: 'Delete' },
    { value: 'LOGIN', label: 'Login' },
    { value: 'LOGOUT', label: 'Logout' },
  ]

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Audit Logs</h1>
          <p className='text-muted-foreground mt-1'>Track all platform activity</p>
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className='w-full sm:w-44' aria-label='Filter by action type'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actionOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {!loading && !error && logs.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <ScrollText className='size-10 text-muted-foreground/50 mb-3' />
            <p className='text-sm font-medium text-muted-foreground'>No audit logs found</p>
            <p className='text-xs text-muted-foreground mt-1'>
              {actionFilter !== 'all'
                ? 'No logs match the selected filter.'
                : 'Audit events will appear here as users interact with the platform.'}
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
                    <div className='min-w-0'>
                      <p className='font-medium text-sm truncate'>
                        {log.actorName || log.actorEmail || 'System'}
                      </p>
                      {log.actorEmail && log.actorName && (
                        <p className='text-xs text-muted-foreground truncate'>{log.actorEmail}</p>
                      )}
                    </div>
                    <Badge variant={actionVariant(log.action)} className='font-mono text-[10px] px-1.5 shrink-0'>
                      {log.action}
                    </Badge>
                  </div>
                  <div className='text-xs text-muted-foreground space-y-0.5'>
                    {log.targetType && (
                      <p>{log.targetType}{log.targetId ? `:${log.targetId.slice(0, 8)}` : ''}</p>
                    )}
                    <div className='flex items-center justify-between'>
                      <span className='font-mono'>{log.ipAddress || '-'}</span>
                      <span>{formatTimestamp(log.createdAt)}</span>
                    </div>
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
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div>
                          <p className='font-medium text-sm'>
                            {log.actorName || log.actorEmail || 'System'}
                          </p>
                          {log.actorEmail && log.actorName && (
                            <p className='text-xs text-muted-foreground'>{log.actorEmail}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={actionVariant(log.action)} className='font-mono text-xs'>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-muted-foreground text-xs'>
                        {log.targetType
                          ? `${log.targetType}${log.targetId ? `:${log.targetId.slice(0, 8)}` : ''}`
                          : '-'}
                      </TableCell>
                      <TableCell className='text-muted-foreground font-mono text-xs'>
                        {log.ipAddress || '-'}
                      </TableCell>
                      <TableCell className='text-muted-foreground text-xs whitespace-nowrap'>
                        {formatTimestamp(log.createdAt)}
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
                Showing {logs.length} of {total} logs
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
