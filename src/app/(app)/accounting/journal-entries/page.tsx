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
import { BookOpen, AlertCircle } from 'lucide-react'

interface JournalEntry {
  id: string; entryNumber: string; date: string; description: string | null
  status: string; referenceType: string | null; createdBy: string | null; createdAt: string
  lines: Array<{
    accountId: string; debit: number; credit: number; description: string | null
    account: { id: string; code: string; name: string }
  }>
}

interface PaginatedResponse {
  success: boolean; data: JournalEntry[]; pagination: { page: number; limit: number; total: number; totalPages: number }
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  POSTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

function formatDate(dateStr: string) {
  try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '-' }
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      const data = await apiFetch<PaginatedResponse>(`/api/v1/accounting/journal-entries?${params}`)
      setEntries(data.data); setTotalPages(data.pagination.totalPages); setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load entries'
      setError(message); toast.error(message)
    } finally { setLoading(false) }
  }, [page])

  useEffect(() => { fetchEntries() }, [fetchEntries])

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
        <h1 className='text-2xl font-bold tracking-tight'>Journal Entries</h1>
        <p className='text-muted-foreground mt-1'>Double-entry bookkeeping journal</p>
      </div>

      {loading && <div className='space-y-3'>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className='h-12' />)}</div>}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 shrink-0 text-destructive' />
            <p className='text-sm text-destructive'>{error}</p>
            <Button variant='outline' size='sm' className='ml-auto shrink-0' onClick={fetchEntries}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && entries.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <BookOpen className='mb-3 size-10 text-muted-foreground/50' />
            <p className='text-sm font-medium text-muted-foreground'>No journal entries yet</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && entries.length > 0 && (
        <>
          <div className='space-y-4'>
            {entries.map((entry) => {
              const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0)
              const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0)
              return (
                <Card key={entry.id}>
                  <CardContent className='p-4'>
                    <div className='flex items-start justify-between'>
                      <div>
                        <div className='flex items-center gap-2'>
                          <span className='font-mono text-sm font-semibold'>{entry.entryNumber}</span>
                          <Badge variant='outline' className={STATUS_BADGE[entry.status] || ''}>{entry.status}</Badge>
                        </div>
                        <p className='mt-1 text-sm text-muted-foreground'>{entry.description || 'No description'}</p>
                        <p className='text-xs text-muted-foreground'>{formatDate(entry.date)}</p>
                      </div>
                      <div className='text-right text-sm'>
                        <p>Debit: <span className='font-medium'>{formatCurrency(totalDebit)}</span></p>
                        <p>Credit: <span className='font-medium'>{formatCurrency(totalCredit)}</span></p>
                      </div>
                    </div>
                    {entry.lines.length > 0 && (
                      <div className='mt-3 overflow-x-auto'>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Account</TableHead>
                              <TableHead className='text-right'>Debit</TableHead>
                              <TableHead className='text-right'>Credit</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entry.lines.map((line, idx) => (
                              <TableRow key={idx}>
                                <TableCell className='text-sm'>{line.account.code} - {line.account.name}</TableCell>
                                <TableCell className='text-right text-sm'>{line.debit > 0 ? formatCurrency(line.debit) : '-'}</TableCell>
                                <TableCell className='text-right text-sm'>{line.credit > 0 ? formatCurrency(line.credit) : '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>Showing {entries.length} of {total} entries</p>
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
