'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, Package, Tag, DollarSign, Warehouse, AlertTriangle, Hash,
} from 'lucide-react'

interface Product {
  id: string; sku: string; name: string; description: string | null; category: string | null
  unit: string; unitPrice: number; costPrice: number; stockQuantity: number
  reorderLevel: number; reorderQuantity: number; warehouse: string | null
  isActive: boolean; metadata: any; createdAt: string; updatedAt: string
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

function formatDate(dateStr: string) {
  try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '-' }
}

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProduct = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await apiFetch<{ success: boolean; data: Product }>(`/api/v1/inventory/products/${id}`)
      setProduct(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load product'
      setError(message); toast.error(message)
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { fetchProduct() }, [fetchProduct])

  if (loading) {
    return (
      <div className='space-y-6'>
        <Skeleton className='h-8 w-40' />
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
          <Skeleton className='h-64' /><Skeleton className='h-64' />
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className='space-y-6'>
        <Button variant='ghost' onClick={() => router.push('/inventory/products')}><ArrowLeft className='mr-2 size-4' />Back to Products</Button>
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center justify-center py-12 text-center'>
            <AlertTriangle className='mr-3 size-5 text-destructive' />
            <p className='text-sm text-destructive'>{error || 'Product not found'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isLowStock = product.stockQuantity <= product.reorderLevel

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='sm' onClick={() => router.push('/inventory/products')}>
          <ArrowLeft className='mr-2 size-4' />Back
        </Button>
        <div className='flex-1'>
          <h1 className='text-2xl font-bold tracking-tight'>{product.name}</h1>
          <p className='text-muted-foreground mt-1'>SKU: {product.sku}</p>
        </div>
        <Badge variant='outline' className={product.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-700'}>
          {product.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        <Card className='lg:col-span-2'>
          <CardHeader><CardTitle className='text-base'>Product Details</CardTitle></CardHeader>
          <CardContent className='space-y-4'>
            {product.description && (
              <div><p className='text-xs text-muted-foreground'>Description</p><p className='mt-1 text-sm'>{product.description}</p></div>
            )}
            <Separator />
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <p className='text-xs text-muted-foreground'>Category</p>
                <p className='mt-1 flex items-center gap-1.5 text-sm font-medium'><Tag className='size-3.5' />{product.category || '-'}</p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Unit</p>
                <p className='mt-1 text-sm font-medium'>{product.unit}</p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Unit Price</p>
                <p className='mt-1 flex items-center gap-1.5 text-sm font-medium'><DollarSign className='size-3.5' />{formatCurrency(product.unitPrice)}</p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Cost Price</p>
                <p className='mt-1 text-sm font-medium text-muted-foreground'>{formatCurrency(product.costPrice)}</p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Warehouse</p>
                <p className='mt-1 flex items-center gap-1.5 text-sm font-medium'><Warehouse className='size-3.5' />{product.warehouse || '-'}</p>
              </div>
              <div>
                <p className='text-xs text-muted-foreground'>Created</p>
                <p className='mt-1 text-sm font-medium'>{formatDate(product.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className='text-base'>Stock Information</CardTitle></CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex flex-col items-center rounded-lg border p-4'>
              <Package className='size-8 text-muted-foreground' />
              <p className='mt-2 text-3xl font-bold'>{product.stockQuantity}</p>
              <p className='text-xs text-muted-foreground'>{product.unit}</p>
              {isLowStock && (
                <Badge variant='outline' className='mt-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'>
                  <AlertTriangle className='mr-1 size-3' /> Low Stock
                </Badge>
              )}
            </div>
            <div className='grid grid-cols-2 gap-3 text-sm'>
              <div><p className='text-xs text-muted-foreground'>Reorder Level</p><p className='font-medium'>{product.reorderLevel}</p></div>
              <div><p className='text-xs text-muted-foreground'>Reorder Qty</p><p className='font-medium'>{product.reorderQuantity}</p></div>
            </div>
            <div>
              <p className='text-xs text-muted-foreground'>Margin</p>
              <p className='font-medium'>
                {product.unitPrice > 0 ? `${(((product.unitPrice - product.costPrice) / product.unitPrice) * 100).toFixed(1)}%` : '-'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
