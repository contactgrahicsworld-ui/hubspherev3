'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Package,
  AlertTriangle,
  Truck,
  DollarSign,
  ArrowRightLeft,
  ClipboardList,
} from 'lucide-react'
import Link from 'next/link'

interface DashboardData {
  totalProducts: number
  activeProducts: number
  lowStockCount: number
  lowStockItems: Array<{
    id: string
    name: string
    sku: string
    stockQuantity: number
    reorderLevel: number
    unit: string
  }>
  totalVendors: number
  totalStockValue: number
  pendingOrders: number
  recentMovements: Array<{
    id: string
    type: string
    quantity: number
    createdAt: string
    product: { id: string; name: string; sku: string }
  }>
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`
  return `$${val.toLocaleString()}`
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return '-' }
}

const MOVEMENT_BADGE: Record<string, string> = {
  IN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  OUT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ADJUSTMENT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  TRANSFER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

export default function InventoryDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch<{ success: boolean; data: DashboardData }>('/api/v1/inventory/dashboard')
      setData(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
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
        <div><h1 className='text-2xl font-bold tracking-tight'>Inventory Dashboard</h1></div>
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

  const metrics = [
    { label: 'Total Products', value: data.totalProducts, icon: <Package className='size-4' />, format: 'number' as const },
    { label: 'Low Stock Alerts', value: data.lowStockCount, icon: <AlertTriangle className='size-4' />, format: 'number' as const, variant: data.lowStockCount > 0 ? 'danger' as const : 'default' as const },
    { label: 'Active Vendors', value: data.totalVendors, icon: <Truck className='size-4' />, format: 'number' as const },
    { label: 'Stock Value', value: data.totalStockValue, icon: <DollarSign className='size-4' />, format: 'currency' as const },
  ]

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Inventory Dashboard</h1>
        <p className='text-muted-foreground mt-1'>Overview of your inventory, stock levels, and procurement</p>
      </div>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className='p-4'>
              <div className='flex items-center gap-3'>
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  m.variant === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-primary/10 text-primary'
                }`}>
                  {m.icon}
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-xs text-muted-foreground'>{m.label}</p>
                  <p className='text-xl font-semibold leading-tight'>
                    {m.format === 'currency' ? formatCurrency(Number(m.value)) : Number(m.value).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className='pb-2'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <AlertTriangle className='size-4 text-amber-500' />
                <CardTitle className='text-base'>Low Stock Alerts</CardTitle>
              </div>
              <Badge variant='outline' className='text-xs'>{data.lowStockItems.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {data.lowStockItems.length > 0 ? (
              <div className='space-y-3'>
                {data.lowStockItems.slice(0, 10).map((item) => (
                  <div key={item.id} className='flex items-center justify-between rounded-lg border p-3'>
                    <div>
                      <p className='text-sm font-medium'>{item.name}</p>
                      <p className='text-xs text-muted-foreground'>SKU: {item.sku}</p>
                    </div>
                    <div className='text-right'>
                      <p className='text-sm font-semibold text-red-600 dark:text-red-400'>
                        {item.stockQuantity} {item.unit}
                      </p>
                      <p className='text-xs text-muted-foreground'>Reorder at {item.reorderLevel}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className='py-8 text-center text-sm text-muted-foreground'>All stock levels are healthy</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Movements */}
        <Card>
          <CardHeader className='pb-2'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <ArrowRightLeft className='size-4 text-muted-foreground' />
                <CardTitle className='text-base'>Recent Stock Movements</CardTitle>
              </div>
              <Link href='/inventory/stock'>
                <Button variant='ghost' size='sm' className='text-xs'>View all</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentMovements.length > 0 ? (
              <div className='space-y-3'>
                {data.recentMovements.map((m) => (
                  <div key={m.id} className='flex items-center justify-between rounded-lg border p-3'>
                    <div className='flex items-center gap-3'>
                      <Badge variant='outline' className={MOVEMENT_BADGE[m.type] || ''}>{m.type}</Badge>
                      <div>
                        <p className='text-sm font-medium'>{m.product.name}</p>
                        <p className='text-xs text-muted-foreground'>{m.product.sku}</p>
                      </div>
                    </div>
                    <div className='text-right'>
                      <p className='text-sm font-medium'>×{m.quantity}</p>
                      <p className='text-xs text-muted-foreground'>{formatDate(m.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className='py-8 text-center text-sm text-muted-foreground'>No recent movements</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex flex-wrap gap-3'>
            <Link href='/inventory/products'>
              <Button variant='outline' size='sm'><Package className='mr-2 size-4' />Manage Products</Button>
            </Link>
            <Link href='/inventory/stock'>
              <Button variant='outline' size='sm'><ArrowRightLeft className='mr-2 size-4' />Stock Movements</Button>
            </Link>
            <Link href='/inventory/purchase-orders'>
              <Button variant='outline' size='sm'><ClipboardList className='mr-2 size-4' />Purchase Orders ({data.pendingOrders} pending)</Button>
            </Link>
            <Link href='/inventory/vendors'>
              <Button variant='outline' size='sm'><Truck className='mr-2 size-4' />Vendors</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
