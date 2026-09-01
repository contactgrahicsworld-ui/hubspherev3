'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// ============================================
// MetricCardSkeleton
// Used in 12 dashboard pages (CRM, HRMS, Communication, Automation, Analytics)
// ============================================

export function MetricCardSkeleton() {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-center gap-3'>
          <Skeleton className='size-9 rounded-lg' />
          <div className='flex-1 space-y-1'>
            <Skeleton className='h-3 w-24' />
            <Skeleton className='h-6 w-16' />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// TableSkeleton
// Used in 22 table pages with varying column counts
// ============================================

interface TableSkeletonProps {
  columns?: number
  rows?: number
}

export function TableSkeleton({ columns = 8, rows = 8 }: TableSkeletonProps) {
  return (
    <Card>
      <CardContent className='p-0'>
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className='h-4 w-20' />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: columns }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className='h-4 w-full' />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ============================================
// ChartSkeleton
// Used in dashboard pages that display charts
// ============================================

export function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <Skeleton className='h-5 w-36' />
      </CardHeader>
      <CardContent>
        <Skeleton className='h-64 w-full rounded-lg' />
      </CardContent>
    </Card>
  )
}

// ============================================
// DetailPageSkeleton
// Used in CRM detail pages (leads, contacts, companies, deals)
// ============================================

export function DetailPageSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-3'>
        <Skeleton className='size-8 rounded-md' />
        <Skeleton className='h-7 w-48' />
      </div>
      <Card>
        <CardContent className='p-6'>
          <Skeleton className='mb-4 h-8 w-64' />
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className='flex gap-3 py-2'>
                <Skeleton className='size-4 rounded' />
                <div className='flex-1 space-y-1'>
                  <Skeleton className='h-3 w-20' />
                  <Skeleton className='h-4 w-32' />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// ProviderCardSkeleton
// Used in Communication pages
// ============================================

export function ProviderCardSkeleton() {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <Skeleton className='size-8 rounded-lg' />
            <div className='space-y-1.5'>
              <Skeleton className='h-4 w-28' />
              <Skeleton className='h-3 w-20' />
            </div>
          </div>
          <Skeleton className='h-6 w-28' />
        </div>
      </CardContent>
    </Card>
  )
}
