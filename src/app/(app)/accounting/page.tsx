'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DollarSign, TrendingUp, TrendingDown, BookOpen, AlertTriangle, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'

interface DashboardData {
  balanceSheet: {
    assets: { accounts: Array<{ id: string; code: string; name: string; balance: number }>; total: number }
    liabilities: { accounts: Array<{ id: string; code: string; name: string; balance: number }>; total: number }
    equity: { accounts: Array<{ id: string; code: string; name: string; balance: number }>; total: number }
  }
  profitAndLoss: {
    revenue: { accounts: Array<{ id: string; code: string; name: string; balance: number }>; total: number }
    expenses: { accounts: Array<{ id: string; code: string; name: string; balance: number }>; total: number }
    netIncome: number
  }
  journalEntries: { draft: number; posted: number }
  recentEntries: Array<any>
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val)
}

export default function AccountingDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await apiFetch<{ success: boolean; data: DashboardData }>('/api/v1/accounting/dashboard')
      setData(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard'
      setError(message); toast.error(message)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  if (loading) {
    return (
      <div className='space-y-6'>
        <div><Skeleton className='h-8 w-48' /><Skeleton className='mt-1 h-4 w-64' /></div>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className='h-24' />)}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className='space-y-6'>
        <h1 className='text-2xl font-bold tracking-tight'>Accounting Dashboard</h1>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertTriangle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>{error || 'Failed to load'}</p>
            <button onClick={fetchDashboard} className='mt-2 text-sm text-primary underline-offset-4 hover:underline'>Try again</button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Accounting Dashboard</h1>
        <p className='text-muted-foreground mt-1'>Financial overview, P&L, and balance sheet</p>
      </div>

      {/* Key Metrics */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'>
                <TrendingUp className='size-4' />
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Total Revenue</p>
                <p className='text-xl font-semibold'>{formatCurrency(data.profitAndLoss.revenue.total)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'>
                <TrendingDown className='size-4' />
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Total Expenses</p>
                <p className='text-xl font-semibold'>{formatCurrency(data.profitAndLoss.expenses.total)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${data.profitAndLoss.netIncome >= 0 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                <DollarSign className='size-4' />
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Net Income</p>
                <p className='text-xl font-semibold'>{formatCurrency(data.profitAndLoss.netIncome)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <BookOpen className='size-4' />
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Total Assets</p>
                <p className='text-xl font-semibold'>{formatCurrency(data.balanceSheet.assets.total)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* P&L Summary */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Profit & Loss</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <p className='text-xs font-medium text-muted-foreground'>REVENUE</p>
              {data.profitAndLoss.revenue.accounts.map((a) => (
                <div key={a.id} className='mt-1 flex justify-between text-sm'>
                  <span className='text-muted-foreground'>{a.code} - {a.name}</span>
                  <span className='font-medium text-emerald-600 dark:text-emerald-400'>{formatCurrency(a.balance)}</span>
                </div>
              ))}
              <Separator className='my-2' />
              <div className='flex justify-between text-sm font-semibold'>
                <span>Total Revenue</span>
                <span className='text-emerald-600 dark:text-emerald-400'>{formatCurrency(data.profitAndLoss.revenue.total)}</span>
              </div>
            </div>
            <div>
              <p className='text-xs font-medium text-muted-foreground'>EXPENSES</p>
              {data.profitAndLoss.expenses.accounts.map((a) => (
                <div key={a.id} className='mt-1 flex justify-between text-sm'>
                  <span className='text-muted-foreground'>{a.code} - {a.name}</span>
                  <span className='font-medium text-red-600 dark:text-red-400'>{formatCurrency(a.balance)}</span>
                </div>
              ))}
              <Separator className='my-2' />
              <div className='flex justify-between text-sm font-semibold'>
                <span>Total Expenses</span>
                <span className='text-red-600 dark:text-red-400'>{formatCurrency(data.profitAndLoss.expenses.total)}</span>
              </div>
            </div>
            <Separator />
            <div className='flex justify-between text-base font-bold'>
              <span>Net Income</span>
              <span className={data.profitAndLoss.netIncome >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                {formatCurrency(data.profitAndLoss.netIncome)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Balance Sheet Summary */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Balance Sheet</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <p className='text-xs font-medium text-muted-foreground'>ASSETS</p>
              {data.balanceSheet.assets.accounts.map((a) => (
                <div key={a.id} className='mt-1 flex justify-between text-sm'>
                  <span className='text-muted-foreground'>{a.code} - {a.name}</span>
                  <span className='font-medium'>{formatCurrency(a.balance)}</span>
                </div>
              ))}
              <Separator className='my-2' />
              <div className='flex justify-between text-sm font-semibold'><span>Total Assets</span><span>{formatCurrency(data.balanceSheet.assets.total)}</span></div>
            </div>
            <div>
              <p className='text-xs font-medium text-muted-foreground'>LIABILITIES</p>
              {data.balanceSheet.liabilities.accounts.map((a) => (
                <div key={a.id} className='mt-1 flex justify-between text-sm'>
                  <span className='text-muted-foreground'>{a.code} - {a.name}</span>
                  <span className='font-medium'>{formatCurrency(a.balance)}</span>
                </div>
              ))}
              <Separator className='my-2' />
              <div className='flex justify-between text-sm font-semibold'><span>Total Liabilities</span><span>{formatCurrency(data.balanceSheet.liabilities.total)}</span></div>
            </div>
            <div>
              <p className='text-xs font-medium text-muted-foreground'>EQUITY</p>
              {data.balanceSheet.equity.accounts.map((a) => (
                <div key={a.id} className='mt-1 flex justify-between text-sm'>
                  <span className='text-muted-foreground'>{a.code} - {a.name}</span>
                  <span className='font-medium'>{formatCurrency(a.balance)}</span>
                </div>
              ))}
              <Separator className='my-2' />
              <div className='flex justify-between text-sm font-semibold'><span>Total Equity</span><span>{formatCurrency(data.balanceSheet.equity.total)}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className='pb-2'><CardTitle className='text-base'>Quick Actions</CardTitle></CardHeader>
        <CardContent>
          <div className='flex flex-wrap gap-3'>
            <Link href='/accounting/accounts'><Button variant='outline' size='sm'><BookOpen className='mr-2 size-4' />Chart of Accounts</Button></Link>
            <Link href='/accounting/journal-entries'><Button variant='outline' size='sm'><ArrowRight className='mr-2 size-4' />Journal Entries ({data.journalEntries.draft} draft)</Button></Link>
            <Link href='/accounting/tax-rates'><Button variant='outline' size='sm'><DollarSign className='mr-2 size-4' />Tax Rates</Button></Link>
            <Link href='/accounting/budgets'><Button variant='outline' size='sm'><TrendingUp className='mr-2 size-4' />Budgets</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
