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
import { Percent, AlertCircle } from 'lucide-react'

interface TaxRate {
  id: string; name: string; rate: number; type: string; isActive: boolean; createdAt: string
}

interface PaginatedResponse {
  success: boolean; data: TaxRate[]; pagination: { page: number; limit: number; total: number; totalPages: number }
}

const TYPE_BADGE: Record<string, string> = {
  GST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  VAT: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  INCOME: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  OTHER: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

export default function TaxRatesPage() {
  const [rates, setRates] = useState<TaxRate[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRates = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const data = await apiFetch<PaginatedResponse>('/api/v1/accounting/tax-rates?limit=50')
      setRates(data.data); setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load tax rates'
      setError(message); toast.error(message)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRates() }, [fetchRates])

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Tax Rates</h1>
        <p className='text-muted-foreground mt-1'>Configure tax rates for GST, VAT, and income tax</p>
      </div>

      {loading && <div className='space-y-3'>{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className='h-12' />)}</div>}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 shrink-0 text-destructive' />
            <p className='text-sm text-destructive'>{error}</p>
            <Button variant='outline' size='sm' className='ml-auto shrink-0' onClick={fetchRates}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && rates.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Percent className='mb-3 size-10 text-muted-foreground/50' />
            <p className='text-sm font-medium text-muted-foreground'>No tax rates configured</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && rates.length > 0 && (
        <Card>
          <CardContent className='p-0'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className='text-right'>Rate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className='font-medium'>{r.name}</TableCell>
                    <TableCell><Badge variant='outline' className={TYPE_BADGE[r.type] || ''}>{r.type}</Badge></TableCell>
                    <TableCell className='text-right font-semibold'>{r.rate}%</TableCell>
                    <TableCell>
                      <Badge variant='outline' className={r.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-700'}>
                        {r.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
