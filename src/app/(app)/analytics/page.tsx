'use client'

import { Card, CardContent } from '@/components/ui/card'
import {
  BarChart3,
  Users,
  Phone,
  MessageSquare,
  Zap,
  Brain,
  TrendingUp,
  Activity,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

// ============================================
// Types
// ============================================

interface DashboardCard {
  title: string
  description: string
  href: string
  icon: React.ReactNode
  colorClass: string
}

// ============================================
// Data
// ============================================

const dashboards: DashboardCard[] = [
  {
    title: 'Executive Dashboard',
    description: 'High-level KPIs across employees, leads, deals, revenue, tasks, and attendance.',
    href: '/analytics/executive',
    icon: <BarChart3 className='size-6' />,
    colorClass: 'bg-primary/10 text-primary',
  },
  {
    title: 'CRM Analytics',
    description: 'Lead source performance, sales funnel, win/loss rates, and follow-up statistics.',
    href: '/analytics/crm',
    icon: <TrendingUp className='size-6' />,
    colorClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  {
    title: 'Telecaller Analytics',
    description: 'Call volume, answer rates, average duration, per-agent stats, and recording availability.',
    href: '/analytics/telecaller',
    icon: <Phone className='size-6' />,
    colorClass: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  },
  {
    title: 'HR Analytics',
    description: 'Employee headcount, attendance, leave, payroll, and department-level insights.',
    href: '/analytics/hr',
    icon: <Users className='size-6' />,
    colorClass: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  },
  {
    title: 'Communication Analytics',
    description: 'Message status counts and channel distribution across WhatsApp, Email, SMS, and In-App.',
    href: '/analytics/communication',
    icon: <MessageSquare className='size-6' />,
    colorClass: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  },
  {
    title: 'Automation Analytics',
    description: 'Active workflows, execution stats, success/failure rates, and top triggers and actions.',
    href: '/analytics/automation',
    icon: <Zap className='size-6' />,
    colorClass: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  },
  {
    title: 'AI Usage Analytics',
    description: 'AI request counts, success/fail rates, usage by agent and model, and latency metrics.',
    href: '/analytics/ai',
    icon: <Brain className='size-6' />,
    colorClass: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  },
]

// ============================================
// Main Page
// ============================================

export default function AnalyticsHubPage() {
  const router = useRouter()

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Analytics Hub</h1>
        <p className='text-muted-foreground mt-1'>
          Explore dashboards and insights across your organization
        </p>
      </div>

      {/* Dashboard Cards Grid */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
        {dashboards.map((dash) => (
          <Card
            key={dash.href}
            className='cursor-pointer transition-colors hover:bg-muted/50'
            onClick={() => router.push(dash.href)}
            role='button'
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') router.push(dash.href)
            }}
          >
            <CardContent className='p-4'>
              <div className='flex items-start gap-3'>
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${dash.colorClass}`}
                >
                  {dash.icon}
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-semibold leading-tight'>{dash.title}</p>
                  <p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
                    {dash.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info */}
      <Card className='border-dashed'>
        <CardContent className='flex items-center gap-3 p-4'>
          <Activity className='size-5 shrink-0 text-muted-foreground' />
          <p className='text-sm text-muted-foreground'>
            Each dashboard fetches real-time data from its respective module. Navigate to a dashboard
            to view detailed analytics.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
