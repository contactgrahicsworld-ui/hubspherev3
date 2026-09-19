'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination'
import { Users, AlertCircle } from 'lucide-react'

interface MarketingList {
  id: string; name: string; type: string; criteria: any; memberCount: number; createdAt: string
}

interface PaginatedResponse {
  success: boolean; data: MarketingList[]; pagination: { page: number; limit: number; total: number; totalPages: number }
}

const TYPE_BADGE: Record<string, string> = {
  STATIC: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DYNAMIC: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

function formatDate(dateStr: string) {
  try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '-' }
}

export default function MarketingListsPage() {
  const [lists, setLists] = useState<MarketingList[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLists = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      const data = await apiFetch<PaginatedResponse>(`/api/v1/marketing/lists?${params}`)
      setLists(data.data); setTotalPages(data.pagination.totalPages); setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load lists'
      setError(message); toast.error(message)
    } finally { setLoading(false) }
  }, [page])

  useEffect(() => { fetchLists() }, [fetchLists])

  const renderPageNumbers = () => {
    const pages: number[] = []; const maxVisible = 5
    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Marketing Lists</h1>
        <p className='text-muted-foreground mt-1'>Manage static and dynamic audience lists for targeting</p>
      </div>

      {loading && <div className='space-y-3'>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className='h-12' />)}</div>}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 shrink-0 text-destructive' />
            <p className='text-sm text-destructive'>{error}</p>
            <Button variant='outline' size='sm' className='ml-auto shrink-0' onClick={fetchLists}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && lists.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Users className='mb-3 size-10 text-muted-foreground/50' />
            <p className='text-sm font-medium text-muted-foreground'>No marketing lists yet</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && lists.length > 0 && (
        <>
          <Card>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className='text-right'>Members</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lists.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className='font-medium'>{l.name}</TableCell>
                      <TableCell><Badge variant='outline' className={TYPE_BADGE[l.type] || ''}>{l.type}</Badge></TableCell>
                      <TableCell className='text-right font-semibold'>{l.memberCount.toLocaleString()}</TableCell>
                      <TableCell className='text-muted-foreground'>{formatDate(l.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>Showing {lists.length} of {total} lists</p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem><PaginationPrevious href='#' onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1) }} className={page <= 1 ? 'pointer-events-none opacity-50' : ''} /></PaginationItem>
                  {renderPageNumbers().map((p) => (<PaginationItem key={p}><PaginationLink href='#' isActive={p === page} onClick={(e) => { e.preventDefault(); setPage(p) }}>{p}</PaginationLink></PaginationItem>))}
                  <PaginationItem><PaginationNext href='#' onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1) }} className={page >= totalPages ? 'pointer-events-none opacity-50' : ''} /></PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  )
}
