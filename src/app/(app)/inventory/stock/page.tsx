'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { ArrowRightLeft, Search, AlertCircle, RotateCcw } from 'lucide-react'

interface StockMovement {
  id: string; productId: string; type: string; quantity: number
  referenceType: string | null; notes: string | null; performedBy: string | null; createdAt: string
  product: { id: string; name: string; sku: string }
}

interface PaginatedResponse {
  success: boolean; data: StockMovement[]; pagination: { page: number; limit: number; total: number; totalPages: number }
}

const MOVEMENT_BADGE: Record<string, string> = {
  IN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  OUT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ADJUSTMENT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  TRANSFER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

function formatDate(dateStr: string) {
  try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return '-' }
}

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState('')
  const [productId, setProductId] = useState('')

  const fetchMovements = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (type) params.set('type', type)
      if (productId) params.set('productId', productId)
      const data = await apiFetch<PaginatedResponse>(`/api/v1/inventory/stock-movements?${params}`)
      setMovements(data.data); setTotalPages(data.pagination.totalPages); setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load movements'
      setError(message); toast.error(message)
    } finally { setLoading(false) }
  }, [page, type, productId])

  useEffect(() => { fetchMovements() }, [fetchMovements])

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
        <h1 className='text-2xl font-bold tracking-tight'>Stock Movements</h1>
        <p className='text-muted-foreground mt-1'>Log of all stock ins, outs, adjustments, and transfers</p>
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <Select value={type} onValueChange={(v) => { setType(v === '_all' ? '' : v); setPage(1) }}>
          <SelectTrigger className='w-[140px]'><SelectValue placeholder='All Types' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='_all'>All Types</SelectItem>
            <SelectItem value='IN'>IN</SelectItem>
            <SelectItem value='OUT'>OUT</SelectItem>
            <SelectItem value='ADJUSTMENT'>Adjustment</SelectItem>
            <SelectItem value='TRANSFER'>Transfer</SelectItem>
          </SelectContent>
        </Select>
        {type && (
          <Button variant='ghost' size='sm' onClick={() => { setType(''); setProductId('') }}>
            <RotateCcw className='size-3' /> Clear
          </Button>
        )}
      </div>

      {loading && <div className='space-y-3'>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className='h-12' />)}</div>}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 shrink-0 text-destructive' />
            <p className='text-sm text-destructive'>{error}</p>
            <Button variant='outline' size='sm' className='ml-auto shrink-0' onClick={fetchMovements}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && movements.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <ArrowRightLeft className='mb-3 size-10 text-muted-foreground/50' />
            <p className='text-sm font-medium text-muted-foreground'>No stock movements yet</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && movements.length > 0 && (
        <>
          <Card>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className='text-right'>Quantity</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell><Badge variant='outline' className={MOVEMENT_BADGE[m.type] || ''}>{m.type}</Badge></TableCell>
                      <TableCell className='font-medium'>{m.product.name}</TableCell>
                      <TableCell className='font-mono text-xs text-muted-foreground'>{m.product.sku}</TableCell>
                      <TableCell className='text-right font-medium'>×{m.quantity}</TableCell>
                      <TableCell className='text-muted-foreground'>{m.referenceType || '-'}</TableCell>
                      <TableCell className='max-w-[200px] truncate text-muted-foreground'>{m.notes || '-'}</TableCell>
                      <TableCell className='whitespace-nowrap text-xs text-muted-foreground'>{formatDate(m.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>Showing {movements.length} of {total} movements</p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href='#' onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1) }} className={page <= 1 ? 'pointer-events-none opacity-50' : ''} />
                  </PaginationItem>
                  {renderPageNumbers().map((p) => (
                    <PaginationItem key={p}><PaginationLink href='#' isActive={p === page} onClick={(e) => { e.preventDefault(); setPage(p) }}>{p}</PaginationLink></PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext href='#' onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1) }} className={page >= totalPages ? 'pointer-events-none opacity-50' : ''} />
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
