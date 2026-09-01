'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Users,
  TrendingUp,
  DollarSign,
  CheckCircle,
  ClipboardList,
  CalendarCheck,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { MetricCardSkeleton } from '@/components/skeletons'

// ============================================
// Types
// ============================================

interface ExecutiveData {
  employees: number
  leads: number
  deals: number
  revenue: number
  tasks: number
  attendance: {
    present: number
    absent: number
    late: number
    rate: number
  }
}

// ============================================
// Helpers
// ============================================

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`
  return `$${val.toLocaleString()}`
}


function KPICard({
  label,
  value,
  icon,
  sub,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  sub?: string
}) {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-center gap-3'>
          <div className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
            {icon}
          </div>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-xs text-muted-foreground'>{label}</p>
            <p className='text-xl font-semibold leading-tight'>{value}</p>
            {sub && (
              <p className='truncate text-[10px] text-muted-foreground'>{sub}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page
// ============================================

export default function ExecutiveDashboardPage() {
  const [data, setData] = useState<ExecutiveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch<{ success: boolean; data: ExecutiveData }>(
        '/api/v1/analytics/executive'
      )
      setData(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load executive dashboard'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ---- Loading State ----
  if (loading) {
    return (
      <div className='space-y-6'>
        <div>
          <Skeleton className='h-8 w-52' />
          <Skeleton className='mt-1 h-4 w-72' />
        </div>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'>
          {Array.from({ length: 6 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
        <Card>
          <CardContent className='p-4'>
            <Skeleton className='mb-4 h-5 w-40' />
            <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className='h-20 w-full rounded-lg' />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Error State ----
  if (error || !data) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Executive Dashboard</h1>
          <p className='text-muted-foreground mt-1'>High-level KPIs across all modules</p>
        </div>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertTriangle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>{error || 'Failed to load executive data'}</p>
            <button
              onClick={fetchData}
              className='mt-2 text-sm text-primary underline-offset-4 hover:underline'
            >
              Try again
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Executive Dashboard</h1>
          <p className='text-muted-foreground mt-1'>High-level KPIs across all modules</p>
        </div>
        <Button variant='outline' size='sm' onClick={fetchData}>
          <RefreshCw className='size-4' />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'>
        <KPICard
          label='Employees'
          value={data.employees.toLocaleString()}
          icon={<Users className='size-4' />}
          sub='Active team members'
        />
        <KPICard
          label='Leads'
          value={data.leads.toLocaleString()}
          icon={<TrendingUp className='size-4' />}
          sub='Total in pipeline'
        />
        <KPICard
          label='Deals'
          value={data.deals.toLocaleString()}
          icon={<DollarSign className='size-4' />}
          sub='Open deals'
        />
        <KPICard
          label='Revenue'
          value={formatCurrency(data.revenue)}
          icon={<DollarSign className='size-4' />}
          sub='Total revenue'
        />
        <KPICard
          label='Tasks'
          value={data.tasks.toLocaleString()}
          icon={<ClipboardList className='size-4' />}
          sub='Active tasks'
        />
        <KPICard
          label='Attendance'
          value={`${data.attendance.rate}%`}
          icon={<CalendarCheck className='size-4' />}
          sub={`${data.attendance.present} present today`}
        />
      </div>

      {/* Attendance Breakdown */}
      <Card>
        <CardContent className='p-4'>
          <h3 className='mb-4 text-sm font-semibold'>Attendance Breakdown</h3>
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
            <div className='rounded-lg border p-3 text-center'>
              <p className='text-lg font-semibold'>{data.attendance.present}</p>
              <p className='text-[10px] text-muted-foreground'>Present</p>
            </div>
            <div className='rounded-lg border p-3 text-center'>
              <p className='text-lg font-semibold'>{data.attendance.absent}</p>
              <p className='text-[10px] text-muted-foreground'>Absent</p>
            </div>
            <div className='rounded-lg border p-3 text-center'>
              <p className='text-lg font-semibold'>{data.attendance.late}</p>
              <p className='text-[10px] text-muted-foreground'>Late</p>
            </div>
            <div className='rounded-lg border p-3 text-center'>
              <p className='text-lg font-semibold'>{data.attendance.rate}%</p>
              <p className='text-[10px] text-muted-foreground'>Attendance Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
