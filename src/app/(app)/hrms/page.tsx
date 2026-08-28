'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  UsersRound,
  UserCheck,
  UserMinus,
  CalendarOff,
  Clock,
  FileText,
  Receipt,
  DollarSign,
  AlertCircle,
  Briefcase,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface DashboardData {
  employees: {
    total: number
    active: number
  }
  attendance: {
    presentToday: number
    absentToday: number
    onLeaveToday: number
    lateToday: number
  }
  leaveRequests: {
    pending: number
  }
  expenses: {
    pending: number
  }
  payroll: {
    byStatus: Record<string, number>
  }
}

interface MetricCard {
  label: string
  value: number
  icon: React.ReactNode
  variant?: 'default' | 'warning' | 'danger' | 'success'
}

// ============================================
// Constants
// ============================================

const PAYROLL_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-muted text-muted-foreground' },
  PROCESSING: { label: 'Processing', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  FINALIZED: { label: 'Finalized', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  PAID: { label: 'Paid', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

// ============================================
// Sub-Components
// ============================================

function MetricCardSkeleton() {
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

function MetricCardDisplay({ card }: { card: MetricCard }) {
  const variantClasses: Record<string, string> = {
    default: 'bg-primary/10 text-primary',
    warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    danger: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  }

  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-center gap-3'>
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
              variantClasses[card.variant ?? 'default']
            }`}
          >
            {card.icon}
          </div>
          <div className='min-w-0 flex-1'>
            <p className='truncate text-xs text-muted-foreground'>{card.label}</p>
            <p className='text-xl font-semibold leading-tight'>{card.value.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PayrollStatusSkeleton() {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <Skeleton className='h-5 w-40' />
      </CardHeader>
      <CardContent>
        <div className='flex flex-wrap gap-3'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-16 w-32 rounded-lg' />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page
// ============================================

export default function HRDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dbUnavailable, setDbUnavailable] = useState(false)

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setDbUnavailable(false)
      const res = await apiFetch<{ success: boolean; data: DashboardData }>(
        '/api/v1/hrms/dashboard'
      )
      setData(res.data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard'
      if (msg.includes('Database unavailable') || msg.includes('503')) {
        setDbUnavailable(true)
        setError('Database is currently unavailable. Please try again later.')
      } else {
        setError(msg)
      }
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // ---- Loading State ----
  if (loading) {
    return (
      <div className='space-y-6'>
        <div>
          <Skeleton className='h-8 w-40' />
          <Skeleton className='mt-1 h-4 w-60' />
        </div>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8'>
          {Array.from({ length: 8 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
        <PayrollStatusSkeleton />
      </div>
    )
  }

  // ---- Error / DB Unavailable State ----
  if (error || !data) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>HR Dashboard</h1>
          <p className='text-muted-foreground mt-1'>Overview of your workforce</p>
        </div>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertCircle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>
              {dbUnavailable ? 'Service Temporarily Unavailable' : error || 'Failed to load dashboard data'}
            </p>
            {dbUnavailable && (
              <p className='text-xs text-muted-foreground'>
                The database is not responding. This is usually a temporary issue.
              </p>
            )}
            <button
              onClick={fetchDashboard}
              className='mt-2 text-sm text-primary underline-offset-4 hover:underline'
            >
              Try again
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Build Metric Cards ----
  const metricCards: MetricCard[] = [
    {
      label: 'Total Employees',
      value: data.employees.total,
      icon: <UsersRound className='size-4' />,
    },
    {
      label: 'Active',
      value: data.employees.active,
      icon: <UserCheck className='size-4' />,
      variant: 'success',
    },
    {
      label: 'Present Today',
      value: data.attendance.presentToday,
      icon: <UserCheck className='size-4' />,
      variant: 'success',
    },
    {
      label: 'Absent Today',
      value: data.attendance.absentToday,
      icon: <UserMinus className='size-4' />,
      variant: data.attendance.absentToday > 0 ? 'danger' : 'default',
    },
    {
      label: 'On Leave',
      value: data.attendance.onLeaveToday,
      icon: <CalendarOff className='size-4' />,
      variant: data.attendance.onLeaveToday > 0 ? 'warning' : 'default',
    },
    {
      label: 'Late Today',
      value: data.attendance.lateToday,
      icon: <Clock className='size-4' />,
      variant: data.attendance.lateToday > 0 ? 'warning' : 'default',
    },
    {
      label: 'Pending Leaves',
      value: data.leaveRequests.pending,
      icon: <FileText className='size-4' />,
      variant: data.leaveRequests.pending > 0 ? 'warning' : 'default',
    },
    {
      label: 'Pending Expenses',
      value: data.expenses.pending,
      icon: <Receipt className='size-4' />,
      variant: data.expenses.pending > 0 ? 'warning' : 'default',
    },
  ]

  // ---- Payroll Status ----
  const payrollStatuses = Object.entries(data.payroll.byStatus)

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>HR Dashboard</h1>
        <p className='text-muted-foreground mt-1'>
          Overview of your workforce and HR operations
        </p>
      </div>

      {/* Metric Cards */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8'>
        {metricCards.map((card) => (
          <MetricCardDisplay key={card.label} card={card} />
        ))}
      </div>

      {/* Payroll Status Summary */}
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex items-center gap-2'>
            <DollarSign className='size-4 text-muted-foreground' />
            <CardTitle className='text-base'>Payroll Status Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {payrollStatuses.length > 0 ? (
            <div className='flex flex-wrap gap-3'>
              {payrollStatuses.map(([status, count]) => {
                const config = PAYROLL_STATUS_CONFIG[status] || {
                  label: status,
                  color: 'bg-muted text-muted-foreground',
                }
                return (
                  <div
                    key={status}
                    className='flex flex-col items-center gap-1.5 rounded-lg border p-4 min-w-[120px]'
                  >
                    <span className='text-2xl font-bold'>{count}</span>
                    <Badge variant='outline' className={config.color}>
                      {config.label}
                    </Badge>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className='flex flex-col items-center justify-center py-8 text-center'>
              <Briefcase className='mb-3 size-10 text-muted-foreground/40' />
              <p className='text-sm font-medium text-muted-foreground'>No payroll records</p>
              <p className='mt-1 text-xs text-muted-foreground'>
                Generate payroll to see status breakdown here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
