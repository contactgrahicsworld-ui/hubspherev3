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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination'
import { BookOpen, AlertCircle, RotateCcw } from 'lucide-react'

interface Account {
  id: string; code: string; name: string; type: string; category: string | null
  parentId: string | null; isActive: boolean; balance: number; createdAt: string
}

interface PaginatedResponse {
  success: boolean; data: Account[]; pagination: { page: number; limit: number; total: number; totalPages: number }
}

const TYPE_BADGE: Record<string, string> = {
  ASSET: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  LIABILITY: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  EQUITY: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  REVENUE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  EXPENSE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState('')

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (type) params.set('type', type)
      const data = await apiFetch<PaginatedResponse>(`/api/v1/accounting/accounts?${params}`)
      setAccounts(data.data); setTotalPages(data.pagination.totalPages); setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load accounts'
      setError(message); toast.error(message)
    } finally { setLoading(false) }
  }, [page, type])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

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
        <h1 className='text-2xl font-bold tracking-tight'>Chart of Accounts</h1>
        <p className='text-muted-foreground mt-1'>Manage your financial account structure</p>
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <Select value={type} onValueChange={(v) => { setType(v === '_all' ? '' : v); setPage(1) }}>
          <SelectTrigger className='w-[140px]'><SelectValue placeholder='All Types' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='_all'>All Types</SelectItem>
            <SelectItem value='ASSET'>Asset</SelectItem>
            <SelectItem value='LIABILITY'>Liability</SelectItem>
            <SelectItem value='EQUITY'>Equity</SelectItem>
            <SelectItem value='REVENUE'>Revenue</SelectItem>
            <SelectItem value='EXPENSE'>Expense</SelectItem>
          </SelectContent>
        </Select>
        {type && <Button variant='ghost' size='sm' onClick={() => setType('')}><RotateCcw className='size-3' /> Clear</Button>}
      </div>

      {loading && <div className='space-y-3'>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className='h-12' />)}</div>}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 shrink-0 text-destructive' />
            <p className='text-sm text-destructive'>{error}</p>
            <Button variant='outline' size='sm' className='ml-auto shrink-0' onClick={fetchAccounts}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && accounts.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <BookOpen className='mb-3 size-10 text-muted-foreground/50' />
            <p className='text-sm font-medium text-muted-foreground'>No accounts yet</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && accounts.length > 0 && (
        <>
          <Card>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className='text-right'>Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className='font-mono text-xs font-semibold'>{a.code}</TableCell>
                      <TableCell className='font-medium'>{a.name}</TableCell>
                      <TableCell><Badge variant='outline' className={TYPE_BADGE[a.type] || ''}>{a.type}</Badge></TableCell>
                      <TableCell className='text-muted-foreground'>{a.category || '-'}</TableCell>
                      <TableCell className='text-right font-medium'>{formatCurrency(a.balance)}</TableCell>
                      <TableCell>
                        <Badge variant='outline' className={a.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-700'}>
                          {a.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>Showing {accounts.length} of {total} accounts</p>
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
