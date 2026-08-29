'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  ArrowLeft,
  Pencil,
  Play,
  Pause,
  Trash2,
  Loader2,
  AlertTriangle,
  Zap,
  GitBranch,
  Filter,
  ArrowDown,
  Clock,
  Plus,
  CheckCircle,
  XCircle,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================
// Types
// ============================================

interface WorkflowTrigger {
  id: string
  eventType: string
  config: Record<string, unknown>
}

interface WorkflowCondition {
  id: string
  field: string
  operator: string
  value: string | null
  logic: 'AND' | 'OR'
  sortOrder: number
}

interface WorkflowAction {
  id: string
  type: string
  config: Record<string, unknown>
  sortOrder: number
  delayMs: number
}

interface WorkflowExecution {
  id: string
  status: string
  triggerEvent: string
  entityType: string | null
  entityId: string | null
  error: string | null
  startedAt: string
  completedAt: string | null
  _count: { logs: number }
}

interface Workflow {
  id: string
  name: string
  description: string | null
  status: string
  triggerType: string
  executionCount: number
  lastExecutedAt: string | null
  createdAt: string
  updatedAt: string
  createdBy: string | null
  updatedBy: string | null
  creator: { id: string; name: string | null; email: string | null } | null
  updater: { id: string; name: string | null; email: string | null } | null
  triggers: WorkflowTrigger[]
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  executions: WorkflowExecution[]
}

// ============================================
// Constants
// ============================================

const TRIGGER_EVENT_LABELS: Record<string, string> = {
  'lead.created': 'Lead Created',
  'lead.updated': 'Lead Updated',
  'lead.assigned': 'Lead Assigned',
  'lead.status_changed': 'Lead Status Changed',
  'deal.created': 'Deal Created',
  'deal.stage_changed': 'Deal Stage Changed',
  'deal.won': 'Deal Won',
  'deal.lost': 'Deal Lost',
  'task.created': 'Task Created',
  'task.completed': 'Task Completed',
  'followup.due': 'Follow-up Due',
  'followup.overdue': 'Follow-up Overdue',
  'call.completed': 'Call Completed',
  'employee.created': 'Employee Created',
  'leave.requested': 'Leave Requested',
  'leave.approved': 'Leave Approved',
  'attendance.checkin': 'Attendance Check-in',
  'attendance.checkout': 'Attendance Check-out',
  'expense.submitted': 'Expense Submitted',
  'expense.approved': 'Expense Approved',
}

const TRIGGER_OPTIONS = Object.entries(TRIGGER_EVENT_LABELS).map(([value, label]) => ({ value, label }))

const ACTION_TYPE_LABELS: Record<string, string> = {
  create_task: 'Create Task',
  update_lead: 'Update Lead',
  update_deal: 'Update Deal',
  change_status: 'Change Status',
  assign_user: 'Assign User',
  create_followup: 'Create Follow-up',
  send_whatsapp: 'Send WhatsApp',
  send_email: 'Send Email',
  send_sms: 'Send SMS',
  create_notification: 'Create Notification',
  delay: 'Delay',
  webhook: 'Webhook',
  ai_action: 'AI Action',
}

const ACTION_OPTIONS = Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => ({ value, label }))

const OPERATOR_LABELS: Record<string, string> = {
  equals: 'Equals',
  not_equals: 'Not equals',
  contains: 'Contains',
  not_contains: 'Not contains',
  greater_than: 'Greater than',
  less_than: 'Less than',
  empty: 'Is empty',
  not_empty: 'Is not empty',
}

const WORKFLOW_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-secondary text-secondary-foreground',
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PAUSED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ARCHIVED: 'bg-muted text-muted-foreground',
}

const EXECUTION_STATUS_STYLES: Record<string, string> = {
  RUNNING: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-muted text-muted-foreground',
}

// ============================================
// Helpers
// ============================================

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return '—'
  }
}

function configSummary(config: Record<string, unknown>): string {
  const entries = Object.entries(config).filter(([, v]) => v != null && v !== '')
  if (entries.length === 0) return 'No configuration'
  return entries.slice(0, 3).map(([k, v]) => `${k}: ${String(v)}`).join(', ')
}

// ============================================
// Sub-Components
// ============================================

function SectionSkeleton() {
  return (
    <div className='space-y-3'>
      <Skeleton className='h-5 w-32' />
      <Skeleton className='h-24 w-full rounded-lg' />
    </div>
  )
}

// ============================================
// Main Page
// ============================================

export default function WorkflowDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)

  // Executions tab
  const [executions, setExecutions] = useState<WorkflowExecution[]>([])
  const [execPage, setExecPage] = useState(1)
  const [execTotalPages, setExecTotalPages] = useState(1)
  const [execLoading, setExecLoading] = useState(false)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Add condition dialog
  const [addCondOpen, setAddCondOpen] = useState(false)
  const [newCondField, setNewCondField] = useState('')
  const [newCondOp, setNewCondOp] = useState('equals')
  const [newCondVal, setNewCondVal] = useState('')
  const [newCondLogic, setNewCondLogic] = useState<'AND' | 'OR'>('AND')

  // Add action dialog
  const [addActionOpen, setAddActionOpen] = useState(false)
  const [newActionType, setNewActionType] = useState('')

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'condition' | 'action'; id: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Active tab
  const [activeTab, setActiveTab] = useState('builder')

  // Fetch workflow
  const fetchWorkflow = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch<{ success: boolean; data: Workflow }>(
        `/api/v1/automation/workflows/${id}`
      )
      setWorkflow(res.data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load workflow'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [id])

  // Fetch executions
  const fetchExecutions = useCallback(async () => {
    try {
      setExecLoading(true)
      const res = await apiFetch<{
        success: boolean
        data: WorkflowExecution[]
        pagination: { total: number; totalPages: number }
      }>(`/api/v1/automation/workflows/${id}/executions?page=${execPage}&limit=10`)
      setExecutions(res.data)
      setExecTotalPages(res.pagination.totalPages)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load executions'
      toast.error(msg)
    } finally {
      setExecLoading(false)
    }
  }, [id, execPage])

  useEffect(() => {
    fetchWorkflow()
  }, [fetchWorkflow])

  useEffect(() => {
    if (activeTab === 'executions') {
      fetchExecutions()
    }
  }, [activeTab, fetchExecutions])

  // ---- Handlers ----

  const handleToggle = async () => {
    if (!workflow) return
    const action = workflow.status === 'ACTIVE' ? 'pause' : 'activate'
    setToggling(true)
    try {
      await apiFetch(`/api/v1/automation/workflows/${id}/${action}`, { method: 'POST' })
      toast.success(`Workflow ${action}d successfully`)
      fetchWorkflow()
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to ${action} workflow`
      toast.error(msg)
    } finally {
      setToggling(false)
    }
  }

  const handleEditOpen = () => {
    if (!workflow) return
    setEditName(workflow.name)
    setEditDesc(workflow.description ?? '')
    setEditOpen(true)
  }

  const handleEditSave = async () => {
    if (!editName.trim() || !workflow) return
    setEditSubmitting(true)
    try {
      await apiFetch(`/api/v1/automation/workflows/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || null,
        }),
      })
      toast.success('Workflow updated successfully')
      setEditOpen(false)
      fetchWorkflow()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update workflow'
      toast.error(msg)
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleAddCondition = async () => {
    if (!newCondField.trim() || !workflow) return
    try {
      const conditions = [
        ...workflow.conditions,
        {
          field: newCondField.trim(),
          operator: newCondOp,
          value: newCondVal.trim() || null,
          logic: newCondLogic,
          sortOrder: workflow.conditions.length,
        },
      ]
      await apiFetch(`/api/v1/automation/workflows/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ conditions }),
      })
      toast.success('Condition added')
      setAddCondOpen(false)
      setNewCondField('')
      setNewCondVal('')
      fetchWorkflow()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add condition'
      toast.error(msg)
    }
  }

  const handleAddAction = async () => {
    if (!newActionType || !workflow) return
    try {
      const actions = [
        ...workflow.actions,
        {
          type: newActionType,
          config: {},
          sortOrder: workflow.actions.length,
          delayMs: 0,
        },
      ]
      await apiFetch(`/api/v1/automation/workflows/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ actions }),
      })
      toast.success('Action added')
      setAddActionOpen(false)
      setNewActionType('')
      fetchWorkflow()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add action'
      toast.error(msg)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !workflow) return
    setDeleting(true)
    try {
      if (deleteTarget.type === 'condition') {
        const conditions = workflow.conditions.filter((c) => c.id !== deleteTarget.id)
        await apiFetch(`/api/v1/automation/workflows/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ conditions }),
        })
      } else {
        const actions = workflow.actions.filter((a) => a.id !== deleteTarget.id)
        await apiFetch(`/api/v1/automation/workflows/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ actions }),
        })
      }
      toast.success('Deleted successfully')
      setDeleteTarget(null)
      fetchWorkflow()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete'
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  // ---- Loading State ----
  if (loading) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center gap-3'>
          <Skeleton className='size-8' />
          <div className='space-y-1'>
            <Skeleton className='h-8 w-60' />
            <Skeleton className='h-4 w-40' />
          </div>
        </div>
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-20 rounded-lg' />
          ))}
        </div>
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    )
  }

  // ---- Error State ----
  if (error || !workflow) {
    return (
      <div className='space-y-6'>
        <Button variant='ghost' size='sm' onClick={() => router.push('/automation/workflows')}>
          <ArrowLeft className='size-4' />
          Back to Workflows
        </Button>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertTriangle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>{error || 'Workflow not found'}</p>
            <button
              onClick={fetchWorkflow}
              className='mt-2 text-sm text-primary underline-offset-4 hover:underline'
            >
              Try again
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Render ----
  return (
    <div className='space-y-6'>
      {/* Back Button + Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='space-y-1'>
          <Button variant='ghost' size='sm' className='-ml-2' onClick={() => router.push('/automation/workflows')}>
            <ArrowLeft className='size-4' />
            Back to Workflows
          </Button>
          <h1 className='text-2xl font-bold tracking-tight'>{workflow.name}</h1>
          {workflow.description && (
            <p className='text-sm text-muted-foreground'>{workflow.description}</p>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <Badge variant='outline' className={cn('text-xs', WORKFLOW_STATUS_STYLES[workflow.status] ?? '')}>
            {workflow.status}
          </Badge>
          {(workflow.status === 'DRAFT' || workflow.status === 'PAUSED') && (
            <Button size='sm' disabled={toggling} onClick={handleToggle}>
              {toggling ? <Loader2 className='size-4 animate-spin' /> : <Play className='size-4' />}
              Activate
            </Button>
          )}
          {workflow.status === 'ACTIVE' && (
            <Button variant='outline' size='sm' disabled={toggling} onClick={handleToggle}>
              {toggling ? <Loader2 className='size-4 animate-spin' /> : <Pause className='size-4' />}
              Pause
            </Button>
          )}
          <Button variant='outline' size='sm' onClick={handleEditOpen}>
            <Pencil className='size-4' />
            Edit
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
        <Card>
          <CardContent className='p-4'>
            <p className='text-xs text-muted-foreground'>Trigger Type</p>
            <p className='mt-1 text-sm font-medium'>
              {TRIGGER_EVENT_LABELS[workflow.triggerType] ?? workflow.triggerType}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <p className='text-xs text-muted-foreground'>Total Executions</p>
            <p className='mt-1 text-sm font-medium'>{workflow.executionCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <p className='text-xs text-muted-foreground'>Last Executed</p>
            <p className='mt-1 text-sm font-medium'>{formatRelativeTime(workflow.lastExecutedAt)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <p className='text-xs text-muted-foreground'>Created</p>
            <p className='mt-1 text-sm font-medium'>{formatDateTime(workflow.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Builder / Executions */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value='builder'>Workflow Builder</TabsTrigger>
          <TabsTrigger value='executions'>Executions</TabsTrigger>
        </TabsList>

        {/* ---- Builder Tab ---- */}
        <TabsContent value='builder' className='mt-4 space-y-6'>
          {/* Desktop: Visual Workflow Builder */}
          <div className='hidden md:block'>
            {/* Trigger Section */}
            <div className='space-y-3'>
              <div className='flex items-center gap-2'>
                <Zap className='size-4 text-primary' />
                <h3 className='text-sm font-semibold'>Trigger</h3>
              </div>
              <div className='relative ml-2 border-l-2 border-primary/30 pl-6'>
                <div className='absolute -left-[5px] top-4 size-2.5 rounded-full bg-primary' />
                {workflow.triggers.map((trigger) => (
                  <Card key={trigger.id} className='mb-3'>
                    <CardContent className='p-4'>
                      <div className='flex items-center justify-between'>
                        <div>
                          <p className='font-medium'>
                            {TRIGGER_EVENT_LABELS[trigger.eventType] ?? trigger.eventType}
                          </p>
                          <p className='mt-1 text-xs text-muted-foreground'>
                            {configSummary(trigger.config as Record<string, unknown>)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {workflow.triggers.length === 0 && (
                  <p className='py-4 text-sm text-muted-foreground'>No trigger configured</p>
                )}
              </div>
            </div>

            {/* Connector Arrow */}
            <div className='flex justify-center py-2'>
              <ArrowDown className='size-5 text-muted-foreground/40' />
            </div>

            {/* Conditions Section */}
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Filter className='size-4 text-amber-500' />
                  <h3 className='text-sm font-semibold'>Conditions</h3>
                  {workflow.conditions.length > 0 && (
                    <Badge variant='outline' className='text-[10px]'>{workflow.conditions.length}</Badge>
                  )}
                </div>
                <Button variant='outline' size='sm' className='h-7 text-xs' onClick={() => setAddCondOpen(true)}>
                  <Plus className='size-3' />
                  Add
                </Button>
              </div>
              <div className='relative ml-2 border-l-2 border-amber-400/30 pl-6'>
                <div className='absolute -left-[5px] top-4 size-2.5 rounded-full bg-amber-500' />
                {workflow.conditions.length > 0 ? (
                  workflow.conditions.map((cond, idx) => (
                    <Card key={cond.id} className='mb-3'>
                      <CardContent className='p-4'>
                        <div className='flex items-start justify-between gap-2'>
                          <div className='min-w-0 flex-1'>
                            <div className='flex flex-wrap items-center gap-2'>
                              <span className='font-medium text-sm'>{cond.field}</span>
                              <span className='text-xs text-muted-foreground'>
                                {OPERATOR_LABELS[cond.operator] ?? cond.operator}
                              </span>
                              {cond.value && (
                                <Badge variant='secondary' className='text-[10px]'>{cond.value}</Badge>
                              )}
                              {idx > 0 && (
                                <Badge variant='outline' className='text-[10px] text-amber-600'>
                                  {cond.logic}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive'
                            onClick={() => setDeleteTarget({ type: 'condition', id: cond.id })}
                          >
                            <X className='size-3.5' />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className='py-4 text-sm text-muted-foreground'>No conditions (runs for all matching triggers)</p>
                )}
              </div>
            </div>

            {/* Connector Arrow */}
            <div className='flex justify-center py-2'>
              <ArrowDown className='size-5 text-muted-foreground/40' />
            </div>

            {/* Actions Section */}
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <GitBranch className='size-4 text-emerald-500' />
                  <h3 className='text-sm font-semibold'>Actions</h3>
                  {workflow.actions.length > 0 && (
                    <Badge variant='outline' className='text-[10px]'>{workflow.actions.length}</Badge>
                  )}
                </div>
                <Button variant='outline' size='sm' className='h-7 text-xs' onClick={() => setAddActionOpen(true)}>
                  <Plus className='size-3' />
                  Add
                </Button>
              </div>
              <div className='relative ml-2 border-l-2 border-emerald-500/30 pl-6'>
                <div className='absolute -left-[5px] top-4 size-2.5 rounded-full bg-emerald-500' />
                {workflow.actions.length > 0 ? (
                  workflow.actions.map((action, idx) => (
                    <Card key={action.id} className='mb-3'>
                      <CardContent className='p-4'>
                        <div className='flex items-start justify-between gap-2'>
                          <div className='min-w-0 flex-1'>
                            <div className='flex flex-wrap items-center gap-2'>
                              <span className='text-xs font-medium text-muted-foreground'>#{idx + 1}</span>
                              <span className='font-medium text-sm'>
                                {ACTION_TYPE_LABELS[action.type] ?? action.type}
                              </span>
                              {action.delayMs > 0 && (
                                <Badge variant='outline' className='text-[10px]'>
                                  <Clock className='mr-1 size-2.5' />
                                  {action.delayMs >= 60000
                                    ? `${Math.round(action.delayMs / 60000)}m`
                                    : `${action.delayMs / 1000}s`} delay
                                </Badge>
                              )}
                            </div>
                            <p className='mt-1 text-xs text-muted-foreground'>
                              {configSummary(action.config as Record<string, unknown>)}
                            </p>
                          </div>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive'
                            onClick={() => setDeleteTarget({ type: 'action', id: action.id })}
                          >
                            <X className='size-3.5' />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className='py-4 text-sm text-muted-foreground'>No actions configured</p>
                )}
              </div>
            </div>
          </div>

          {/* Mobile: Accordion Step-by-Step Editor */}
          <div className='md:hidden'>
            <Accordion type='multiple' defaultValue={['trigger', 'conditions', 'actions']} className='space-y-3'>
              {/* Trigger */}
              <AccordionItem value='trigger'>
                <AccordionTrigger className='px-4'>
                  <div className='flex items-center gap-2'>
                    <Zap className='size-4 text-primary' />
                    <span className='text-sm font-semibold'>Trigger</span>
                    <Badge variant='outline' className='text-[10px]'>{workflow.triggers.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className='px-4 pb-4'>
                  {workflow.triggers.length > 0 ? (
                    <div className='space-y-2'>
                      {workflow.triggers.map((trigger) => (
                        <Card key={trigger.id}>
                          <CardContent className='p-3'>
                            <p className='text-sm font-medium'>
                              {TRIGGER_EVENT_LABELS[trigger.eventType] ?? trigger.eventType}
                            </p>
                            <p className='mt-1 text-xs text-muted-foreground'>
                              {configSummary(trigger.config as Record<string, unknown>)}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className='text-sm text-muted-foreground'>No trigger configured</p>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Conditions */}
              <AccordionItem value='conditions'>
                <AccordionTrigger className='px-4'>
                  <div className='flex items-center gap-2'>
                    <Filter className='size-4 text-amber-500' />
                    <span className='text-sm font-semibold'>Conditions</span>
                    <Badge variant='outline' className='text-[10px]'>{workflow.conditions.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className='px-4 pb-4'>
                  <div className='space-y-2'>
                    {workflow.conditions.map((cond, idx) => (
                      <Card key={cond.id}>
                        <CardContent className='p-3'>
                          <div className='flex items-start justify-between gap-2'>
                            <div>
                              <div className='flex flex-wrap items-center gap-1.5'>
                                <span className='text-sm font-medium'>{cond.field}</span>
                                <span className='text-xs text-muted-foreground'>
                                  {OPERATOR_LABELS[cond.operator] ?? cond.operator}
                                </span>
                                {cond.value && (
                                  <Badge variant='secondary' className='text-[10px]'>{cond.value}</Badge>
                                )}
                                {idx > 0 && (
                                  <Badge variant='outline' className='text-[10px] text-amber-600'>
                                    {cond.logic}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-6 w-6 p-0 text-destructive'
                              onClick={() => setDeleteTarget({ type: 'condition', id: cond.id })}
                            >
                              <X className='size-3' />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <Button variant='outline' size='sm' className='w-full' onClick={() => setAddCondOpen(true)}>
                      <Plus className='size-3.5' />
                      Add Condition
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Actions */}
              <AccordionItem value='actions'>
                <AccordionTrigger className='px-4'>
                  <div className='flex items-center gap-2'>
                    <GitBranch className='size-4 text-emerald-500' />
                    <span className='text-sm font-semibold'>Actions</span>
                    <Badge variant='outline' className='text-[10px]'>{workflow.actions.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className='px-4 pb-4'>
                  <div className='space-y-2'>
                    {workflow.actions.map((action, idx) => (
                      <Card key={action.id}>
                        <CardContent className='p-3'>
                          <div className='flex items-start justify-between gap-2'>
                            <div className='min-w-0 flex-1'>
                              <div className='flex flex-wrap items-center gap-1.5'>
                                <span className='text-[10px] text-muted-foreground'>#{idx + 1}</span>
                                <span className='text-sm font-medium'>
                                  {ACTION_TYPE_LABELS[action.type] ?? action.type}
                                </span>
                                {action.delayMs > 0 && (
                                  <Badge variant='outline' className='text-[10px]'>
                                    <Clock className='mr-0.5 size-2.5' />
                                    {action.delayMs >= 60000
                                      ? `${Math.round(action.delayMs / 60000)}m`
                                      : `${action.delayMs / 1000}s`}
                                  </Badge>
                                )}
                              </div>
                              <p className='mt-1 text-xs text-muted-foreground'>
                                {configSummary(action.config as Record<string, unknown>)}
                              </p>
                            </div>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-6 w-6 p-0 text-destructive'
                              onClick={() => setDeleteTarget({ type: 'action', id: action.id })}
                            >
                              <X className='size-3' />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <Button variant='outline' size='sm' className='w-full' onClick={() => setAddActionOpen(true)}>
                      <Plus className='size-3.5' />
                      Add Action
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </TabsContent>

        {/* ---- Executions Tab ---- */}
        <TabsContent value='executions' className='mt-4 space-y-4'>
          {execLoading ? (
            <Card>
              <CardContent className='space-y-3 p-4'>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className='h-12 w-full' />
                ))}
              </CardContent>
            </Card>
          ) : executions.length > 0 ? (
            <>
              <div className='space-y-2'>
                {executions.map((exec) => (
                  <Card key={exec.id}>
                    <CardContent className='p-4'>
                      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='min-w-0 flex-1 space-y-1'>
                          <div className='flex items-center gap-2'>
                            <Badge
                              variant='outline'
                              className={cn('text-[10px]', EXECUTION_STATUS_STYLES[exec.status] ?? '')}
                            >
                              {exec.status}
                            </Badge>
                            <span className='text-xs text-muted-foreground'>
                              {TRIGGER_EVENT_LABELS[exec.triggerEvent] ?? exec.triggerEvent}
                            </span>
                          </div>
                          <p className='text-xs text-muted-foreground'>
                            {formatDateTime(exec.startedAt)}
                            {exec.completedAt && (
                              <span>
                                {' '}→ {formatDateTime(exec.completedAt)}
                              </span>
                            )}
                          </p>
                          {exec.error && (
                            <p className='text-xs text-destructive'>{exec.error}</p>
                          )}
                        </div>
                        <div className='text-right'>
                          <p className='text-xs text-muted-foreground'>{exec._count.logs} log entries</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {execTotalPages > 1 && (
                <div className='flex justify-center'>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href='#'
                          onClick={(e) => { e.preventDefault(); if (execPage > 1) setExecPage(execPage - 1) }}
                          aria-disabled={execPage <= 1}
                          className={execPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href='#' isActive>
                          {execPage} / {execTotalPages}
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          href='#'
                          onClick={(e) => { e.preventDefault(); if (execPage < execTotalPages) setExecPage(execPage + 1) }}
                          aria-disabled={execPage >= execTotalPages}
                          className={execPage >= execTotalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <Card>
              <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
                <Clock className='mb-3 size-8 text-muted-foreground/40' />
                <p className='text-sm text-muted-foreground'>No executions yet</p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  Executions will appear here when this workflow runs.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ---- Edit Dialog ---- */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Edit Workflow</DialogTitle>
            <DialogDescription>Update workflow name and description.</DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='edit-name'>Name</Label>
              <Input
                id='edit-name'
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-desc'>Description</Label>
              <Textarea
                id='edit-desc'
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                maxLength={5000}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button disabled={!editName.trim() || editSubmitting} onClick={handleEditSave}>
              {editSubmitting && <Loader2 className='size-4 animate-spin' />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Add Condition Dialog ---- */}
      <Dialog open={addCondOpen} onOpenChange={setAddCondOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Add Condition</DialogTitle>
            <DialogDescription>Define a condition to filter when this workflow runs.</DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='cond-field'>Field</Label>
              <Input
                id='cond-field'
                placeholder='e.g., source, status, value'
                value={newCondField}
                onChange={(e) => setNewCondField(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label>Operator</Label>
              <Select value={newCondOp} onValueChange={setNewCondOp}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OPERATOR_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='cond-val'>Value</Label>
              <Input
                id='cond-val'
                placeholder='Value to compare against'
                value={newCondVal}
                onChange={(e) => setNewCondVal(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label>Logic</Label>
              <Select value={newCondLogic} onValueChange={(v) => setNewCondLogic(v as 'AND' | 'OR')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='AND'>AND (all conditions must match)</SelectItem>
                  <SelectItem value='OR'>OR (any condition can match)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setAddCondOpen(false)}>Cancel</Button>
            <Button disabled={!newCondField.trim()} onClick={handleAddCondition}>
              Add Condition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Add Action Dialog ---- */}
      <Dialog open={addActionOpen} onOpenChange={setAddActionOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Add Action</DialogTitle>
            <DialogDescription>Choose an action to execute when the workflow runs.</DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label>Action Type</Label>
              <Select value={newActionType} onValueChange={setNewActionType}>
                <SelectTrigger>
                  <SelectValue placeholder='Select an action' />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setAddActionOpen(false)}>Cancel</Button>
            <Button disabled={!newActionType} onClick={handleAddAction}>
              Add Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Delete Confirmation ---- */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === 'condition' ? 'Condition' : 'Action'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {deleteTarget?.type}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleting && <Loader2 className='size-4 animate-spin' />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
