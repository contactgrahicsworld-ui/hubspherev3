'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CalendarCheck,
  CalendarX,
  Clock,
  Users,
  MapPin,
  Receipt,
  Banknote,
  AlertTriangle,
  Filter,
  RefreshCw,
  Building2,
  UserCheck,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface AttendanceTrends {
  present: number
  absent: number
  late: number
  halfDay: number
  onLeave: number
  holiday: number
  weekOff: number
  total: number
}

interface LeaveTrends {
  approved: number
  rejected: number
  pending: number
  cancelled: number
  total: number
}

interface DepartmentItem {
  departmentId: string | null
  departmentName: string
  employeeCount: number
}

interface EmployeeStatusItem {
  status: string
  count: number
}

interface ExpenseStatusDetail {
  count: number
  amount: number
}

interface ExpenseTrends {
  totalAmount: number
  totalCount: number
  approved: ExpenseStatusDetail
  pending: ExpenseStatusDetail
  rejected: ExpenseStatusDetail
  paid: ExpenseStatusDetail
}

interface PayrollStatus {
  draft: number
  processing: number
  finalized: number
  paid: number
  cancelled: number
  total: number
}

interface HRAnalyticsData {
  attendanceTrends: AttendanceTrends
  leaveTrends: LeaveTrends
  departmentDistribution: DepartmentItem[]
  employeeStatus: EmployeeStatusItem[]
  fieldVisitActivity: Record<string, number>
  expenseTrends: ExpenseTrends
  payrollStatus: PayrollStatus
}

// ============================================
// Constants
// ============================================

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ON_LEAVE: 'On Leave',
  RESIGNED: 'Resigned',
  TERMINATED: 'Terminated',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  INACTIVE: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  ON_LEAVE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  RESIGNED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  TERMINATED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const FIELD_VISIT_LABELS: Record<string, string> = {
  PLANNED: 'Planned',
  STARTED: 'Started',
  COMPLETED: 'Completed',
  MISSED: 'Missed',
  CANCELLED: 'Cancelled',
}

const FIELD_VISIT_COLORS: Record<string, string> = {
  PLANNED: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  STARTED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  MISSED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
}

// ============================================
// Helpers
// ============================================

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`
  return `$${val.toLocaleString()}`
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

function KPICard({
  label,
  value,
  icon,
  sub,
  iconBg,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  sub?: string
  iconBg?: string
}) {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-center gap-3'>
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconBg ?? 'bg-primary/10 text-primary'}`}
          >
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

function StatBlock({ label, value }: { label: string; value: number | string }) {
  return (
    <div className='rounded-lg border p-3 text-center'>
      <p className='text-lg font-semibold'>{value}</p>
      <p className='text-[10px] text-muted-foreground'>{label}</p>
    </div>
  )
}

// ============================================
// Main Page
// ============================================

export default function HRAnalyticsPage() {
  const [data, setData] = useState<HRAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const qs = params.toString()
      const res = await apiFetch<{ success: boolean; data: HRAnalyticsData }>(
        `/api/v1/analytics/hr${qs ? `?${qs}` : ''}`,
      )
      setData(res.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load HR analytics'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // ---- Loading State ----
  if (loading) {
    return (
      <div className='space-y-6'>
        <div>
          <Skeleton className='h-8 w-36' />
          <Skeleton className='mt-1 h-4 w-64' />
        </div>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
          <Skeleton className='h-9 w-40' />
          <Skeleton className='h-9 w-40' />
          <Skeleton className='h-9 w-24' />
        </div>
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6'>
          {Array.from({ length: 6 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='h-5 w-40' />
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className='h-20 w-full rounded-lg' />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='h-5 w-40' />
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className='h-20 w-full rounded-lg' />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ---- Error State ----
  if (error || !data) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>HR Analytics</h1>
          <p className='text-muted-foreground mt-1'>
            Attendance, leave, expenses, and workforce insights
          </p>
        </div>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertTriangle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>
              {error || 'Failed to load HR analytics data'}
            </p>
            <button
              onClick={fetchAnalytics}
              className='mt-2 text-sm text-primary underline-offset-4 hover:underline'
            >
              Try again
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Computed ----
  const att = data.attendanceTrends
  const leave = data.leaveTrends
  const exp = data.expenseTrends
  const pr = data.payrollStatus
  const deptMax =
    data.departmentDistribution.length > 0
      ? Math.max(...data.departmentDistribution.map((d) => d.employeeCount))
      : 1
  const totalEmployees = data.employeeStatus.reduce((s, e) => s + e.count, 0)

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>HR Analytics</h1>
          <p className='text-muted-foreground mt-1'>
            Attendance, leave, expenses, and workforce insights
          </p>
        </div>
        <Button variant='outline' size='sm' onClick={fetchAnalytics}>
          <RefreshCw className='size-4' />
          Refresh
        </Button>
      </div>

      {/* Date Range Filter */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
        <div className='space-y-1'>
          <label className='text-xs font-medium text-muted-foreground'>From</label>
          <Input
            type='date'
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className='w-full sm:w-44'
          />
        </div>
        <div className='space-y-1'>
          <label className='text-xs font-medium text-muted-foreground'>To</label>
          <Input
            type='date'
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className='w-full sm:w-44'
          />
        </div>
        <Button variant='outline' size='sm' onClick={fetchAnalytics}>
          <Filter className='size-4' />
          Apply
        </Button>
      </div>

      {/* KPI Cards */}
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6'>
        <KPICard
          label='Present Today'
          value={att.present.toLocaleString()}
          icon={<CalendarCheck className='size-4' />}
          sub={`${att.total} total records`}
          iconBg='bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
        />
        <KPICard
          label='Absent'
          value={att.absent.toLocaleString()}
          icon={<CalendarX className='size-4' />}
          sub={`${att.late} late`}
          iconBg='bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
        />
        <KPICard
          label='Leave Pending'
          value={leave.pending.toLocaleString()}
          icon={<Clock className='size-4' />}
          sub={`${leave.total} total requests`}
          iconBg='bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
        />
        <KPICard
          label='Total Employees'
          value={totalEmployees.toLocaleString()}
          icon={<Users className='size-4' />}
          sub={`${data.departmentDistribution.length} departments`}
          iconBg='bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400'
        />
        <KPICard
          label='Expenses'
          value={formatCurrency(exp.totalAmount)}
          icon={<Receipt className='size-4' />}
          sub={`${exp.totalCount} claims`}
          iconBg='bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
        />
        <KPICard
          label='Payroll Paid'
          value={pr.paid.toLocaleString()}
          icon={<Banknote className='size-4' />}
          sub={`${pr.total} total records`}
          iconBg='bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
        />
      </div>

      {/* Row: Attendance + Leave Trends */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Attendance Breakdown */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <CalendarCheck className='size-4' />
              Attendance Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
              <StatBlock label='Present' value={att.present} />
              <StatBlock label='Absent' value={att.absent} />
              <StatBlock label='Late' value={att.late} />
              <StatBlock label='Half Day' value={att.halfDay} />
              <StatBlock label='On Leave' value={att.onLeave} />
              <StatBlock label='Holiday' value={att.holiday} />
              <StatBlock label='Week Off' value={att.weekOff} />
              <StatBlock label='Total' value={att.total} />
            </div>
          </CardContent>
        </Card>

        {/* Leave Trends */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Clock className='size-4' />
              Leave Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
              <StatBlock label='Approved' value={leave.approved} />
              <StatBlock label='Rejected' value={leave.rejected} />
              <StatBlock label='Pending' value={leave.pending} />
              <StatBlock label='Cancelled' value={leave.cancelled} />
            </div>
            {leave.total > 0 && (
              <div className='mt-4'>
                <div className='h-3 w-full overflow-hidden rounded-full bg-secondary'>
                  <div className='flex h-full'>
                    <div
                      className='h-full bg-emerald-500 transition-all'
                      style={{
                        width: `${((leave.approved / leave.total) * 100).toFixed(1)}%`,
                      }}
                    />
                    <div
                      className='h-full bg-red-500 transition-all'
                      style={{
                        width: `${((leave.rejected / leave.total) * 100).toFixed(1)}%`,
                      }}
                    />
                    <div
                      className='h-full bg-amber-500 transition-all'
                      style={{
                        width: `${((leave.pending / leave.total) * 100).toFixed(1)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className='mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground'>
                  <span className='flex items-center gap-1'>
                    <span className='inline-block size-2 rounded-full bg-emerald-500' />
                    Approved {leave.approved}
                  </span>
                  <span className='flex items-center gap-1'>
                    <span className='inline-block size-2 rounded-full bg-red-500' />
                    Rejected {leave.rejected}
                  </span>
                  <span className='flex items-center gap-1'>
                    <span className='inline-block size-2 rounded-full bg-amber-500' />
                    Pending {leave.pending}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row: Department Distribution + Employee Status */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Department Distribution */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Building2 className='size-4' />
              Department Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.departmentDistribution.length > 0 ? (
              <div className='max-h-72 space-y-3 overflow-y-auto'>
                {data.departmentDistribution.map((dept) => {
                  const pct =
                    deptMax > 0
                      ? ((dept.employeeCount / deptMax) * 100).toFixed(0)
                      : 0
                  return (
                    <div key={dept.departmentId ?? 'unassigned'} className='space-y-1'>
                      <div className='flex items-center justify-between text-sm'>
                        <span className='truncate text-muted-foreground'>
                          {dept.departmentName}
                        </span>
                        <span className='ml-2 shrink-0 font-medium'>
                          {dept.employeeCount}
                        </span>
                      </div>
                      <div className='h-2 w-full overflow-hidden rounded-full bg-secondary'>
                        <div
                          className='h-full rounded-full bg-primary transition-all'
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className='flex h-32 items-center justify-center text-sm text-muted-foreground'>
                No department data available yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employee Status */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <UserCheck className='size-4' />
              Employee Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.employeeStatus.length > 0 ? (
              <div className='space-y-3'>
                {data.employeeStatus.map((es) => (
                  <div
                    key={es.status}
                    className='flex items-center justify-between'
                  >
                    <span className='text-sm text-muted-foreground'>
                      {STATUS_LABELS[es.status] || es.status}
                    </span>
                    <Badge className={STATUS_COLORS[es.status] ?? ''}>
                      {es.count}
                    </Badge>
                  </div>
                ))}
                {totalEmployees > 0 && (
                  <div className='h-3 w-full overflow-hidden rounded-full bg-secondary'>
                    <div className='flex h-full'>
                      {data.employeeStatus.map((es) => {
                        const width = ((es.count / totalEmployees) * 100).toFixed(1)
                        const colorMap: Record<string, string> = {
                          ACTIVE: 'bg-emerald-500',
                          INACTIVE: 'bg-gray-400',
                          ON_LEAVE: 'bg-amber-500',
                          RESIGNED: 'bg-red-500',
                          TERMINATED: 'bg-red-700',
                        }
                        return (
                          <div
                            key={es.status}
                            className={`h-full transition-all ${colorMap[es.status] ?? 'bg-gray-500'}`}
                            style={{ width: `${width}%` }}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className='flex h-32 items-center justify-center text-sm text-muted-foreground'>
                No employee status data available yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row: Field Visit Activity + Expense Summary */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Field Visit Activity */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <MapPin className='size-4' />
              Field Visit Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(data.fieldVisitActivity).length > 0 ? (
              <div className='space-y-3'>
                {Object.entries(data.fieldVisitActivity).map(([status, count]) => (
                  <div
                    key={status}
                    className='flex items-center justify-between'
                  >
                    <span className='text-sm text-muted-foreground'>
                      {FIELD_VISIT_LABELS[status] || status}
                    </span>
                    <Badge className={FIELD_VISIT_COLORS[status] ?? ''}>
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className='flex h-32 items-center justify-center text-sm text-muted-foreground'>
                No field visit data available yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expense Summary */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Receipt className='size-4' />
              Expense Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='mb-4 flex items-center justify-between'>
              <span className='text-sm font-medium'>Total Amount</span>
              <span className='text-lg font-semibold'>
                {formatCurrency(exp.totalAmount)}
              </span>
            </div>
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-muted-foreground'>Approved</span>
                <div className='text-right'>
                  <span className='text-sm font-semibold'>
                    {formatCurrency(exp.approved.amount)}
                  </span>
                  <span className='ml-2 text-xs text-muted-foreground'>
                    ({exp.approved.count})
                  </span>
                </div>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-muted-foreground'>Pending</span>
                <div className='text-right'>
                  <span className='text-sm font-semibold'>
                    {formatCurrency(exp.pending.amount)}
                  </span>
                  <span className='ml-2 text-xs text-muted-foreground'>
                    ({exp.pending.count})
                  </span>
                </div>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-muted-foreground'>Rejected</span>
                <div className='text-right'>
                  <span className='text-sm font-semibold'>
                    {formatCurrency(exp.rejected.amount)}
                  </span>
                  <span className='ml-2 text-xs text-muted-foreground'>
                    ({exp.rejected.count})
                  </span>
                </div>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-muted-foreground'>Paid</span>
                <div className='text-right'>
                  <span className='text-sm font-semibold'>
                    {formatCurrency(exp.paid.amount)}
                  </span>
                  <span className='ml-2 text-xs text-muted-foreground'>
                    ({exp.paid.count})
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Status */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Banknote className='size-4' />
            Payroll Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-5'>
            <StatBlock label='Draft' value={pr.draft} />
            <StatBlock label='Processing' value={pr.processing} />
            <StatBlock label='Finalized' value={pr.finalized} />
            <StatBlock label='Paid' value={pr.paid} />
            <StatBlock label='Cancelled' value={pr.cancelled} />
          </div>
          {pr.total > 0 && (
            <div className='mt-4'>
              <div className='h-3 w-full overflow-hidden rounded-full bg-secondary'>
                <div className='flex h-full'>
                  <div
                    className='h-full bg-gray-400 transition-all'
                    style={{ width: `${((pr.draft / pr.total) * 100).toFixed(1)}%` }}
                  />
                  <div
                    className='h-full bg-amber-500 transition-all'
                    style={{ width: `${((pr.processing / pr.total) * 100).toFixed(1)}%` }}
                  />
                  <div
                    className='h-full bg-sky-500 transition-all'
                    style={{ width: `${((pr.finalized / pr.total) * 100).toFixed(1)}%` }}
                  />
                  <div
                    className='h-full bg-emerald-500 transition-all'
                    style={{ width: `${((pr.paid / pr.total) * 100).toFixed(1)}%` }}
                  />
                </div>
              </div>
              <div className='mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground'>
                <span className='flex items-center gap-1'>
                  <span className='inline-block size-2 rounded-full bg-gray-400' />
                  Draft {pr.draft}
                </span>
                <span className='flex items-center gap-1'>
                  <span className='inline-block size-2 rounded-full bg-amber-500' />
                  Processing {pr.processing}
                </span>
                <span className='flex items-center gap-1'>
                  <span className='inline-block size-2 rounded-full bg-sky-500' />
                  Finalized {pr.finalized}
                </span>
                <span className='flex items-center gap-1'>
                  <span className='inline-block size-2 rounded-full bg-emerald-500' />
                  Paid {pr.paid}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
