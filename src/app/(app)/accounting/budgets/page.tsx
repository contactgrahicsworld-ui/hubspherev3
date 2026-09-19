'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination'
import { TrendingUp, AlertCircle } from 'lucide-react'

interface Budget {
  id: string; accountId: string; name: string; period: string
  allocatedAmount: number; spentAmount: number; createdAt: string
  account: { id: string; code: string; name: string }
}

interface PaginatedResponse {
  success: boolean; data: Budget[]; pagination: { page: number; limit: number; total: number; totalPages: number }
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBudgets = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      const data = await apiFetch<PaginatedResponse>(`/api/v1/accounting/budgets?${params}`)
      setBudgets(data.data); setTotalPages(data.pagination.totalPages); setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load budgets'
      setError(message); toast.error(message)
    } finally { setLoading(false) }
  }, [page])

  useEffect(() => { fetchBudgets() }, [fetchBudgets])

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
        <h1 className='text-2xl font-bold tracking-tight'>Budgets</h1>
        <p className='text-muted-foreground mt-1'>Budget vs actual spending by account and period</p>
      </div>

      {loading && <div className='space-y-3'>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className='h-12' />)}</div>}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 shrink-0 text-destructive' />
            <p className='text-sm text-destructive'>{error}</p>
            <Button variant='outline' size='sm' className='ml-auto shrink-0' onClick={fetchBudgets}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && budgets.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <TrendingUp className='mb-3 size-10 text-muted-foreground/50' />
            <p className='text-sm font-medium text-muted-foreground'>No budgets configured</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && budgets.length > 0 && (
        <>
          <div className='space-y-4'>
            {budgets.map((b) => {
              const pct = b.allocatedAmount > 0 ? (b.spentAmount / b.allocatedAmount) * 100 : 0
              const isOver = pct > 100
              return (
                <Card key={b.id}>
                  <CardContent className='p-4'>
                    <div className='flex items-start justify-between'>
                      <div>
                        <p className='font-medium'>{b.name}</p>
                        <p className='text-sm text-muted-foreground'>{b.account.code} - {b.account.name}</p>
                        <p className='text-xs text-muted-foreground'>Period: {b.period}</p>
                      </div>
                      <div className='text-right'>
                        <Badge variant='outline' className={isOver ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}>
                          {pct.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                    <div className='mt-3'>
                      <div className='mb-1 flex justify-between text-xs text-muted-foreground'>
                        <span>{formatCurrency(b.spentAmount)} spent</span>
                        <span>{formatCurrency(b.allocatedAmount)} allocated</span>
                      </div>
                      <div className='h-2.5 w-full overflow-hidden rounded-full bg-secondary'>
                        <div
                          className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>Showing {budgets.length} of {total} budgets</p>
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
