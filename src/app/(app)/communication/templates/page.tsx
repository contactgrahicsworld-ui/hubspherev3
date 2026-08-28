'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Search,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  FileText,
  RotateCcw,
  Filter,
  Code2,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================
// Types
// ============================================

interface Template {
  id: string
  name: string
  channel: string
  category: string
  status: string
  subject: string | null
  body: string
  variables: string[]
  createdAt: string
  updatedAt: string
}

interface TemplatesResponse {
  success: boolean
  data: Template[]
}

// ============================================
// Constants
// ============================================

const CHANNEL_TABS = [
  { value: '', label: 'All' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'IN_APP', label: 'In-App' },
  { value: 'PUSH', label: 'Push' },
]

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'TRANSACTIONAL', label: 'Transactional' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'NOTIFICATION', label: 'Notification' },
  { value: 'ALERT', label: 'Alert' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
]

const CHANNEL_BADGE_STYLES: Record<string, string> = {
  WHATSAPP: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  EMAIL: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  SMS: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  IN_APP: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  PUSH: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ARCHIVED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

const CATEGORY_BADGE_STYLES: Record<string, string> = {
  TRANSACTIONAL: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  MARKETING: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  NOTIFICATION: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  ALERT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const CHANNEL_OPTIONS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'IN_APP', label: 'In-App' },
  { value: 'PUSH', label: 'Push' },
]

const CATEGORY_FORM_OPTIONS = [
  { value: 'TRANSACTIONAL', label: 'Transactional' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'NOTIFICATION', label: 'Notification' },
  { value: 'ALERT', label: 'Alert' },
]

// ============================================
// Skeletons
// ============================================

function TemplateCardSkeleton() {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex-1 space-y-2'>
            <Skeleton className='h-5 w-40' />
            <Skeleton className='h-3 w-24' />
          </div>
          <Skeleton className='h-6 w-16' />
        </div>
        <div className='mt-3 space-y-2'>
          <Skeleton className='h-3 w-full' />
          <Skeleton className='h-3 w-3/4' />
        </div>
        <div className='mt-3 flex gap-2'>
          <Skeleton className='h-5 w-16' />
          <Skeleton className='h-5 w-20' />
          <Skeleton className='h-5 w-14' />
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Template Card
// ============================================

function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: Template
  onEdit: (t: Template) => void
  onDelete: (t: Template) => void
}) {
  const [showPreview, setShowPreview] = useState(false)

  // Replace {{variables}} with placeholder values for preview
  const previewBody = template.body
    .replace(/\{\{(\w+)\}\}/g, (_match, varName) => `[${varName}]`)
    .substring(0, 200)

  return (
    <Card className='transition-shadow hover:shadow-md'>
      <CardContent className='p-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-2'>
              <p className='truncate text-sm font-semibold'>{template.name}</p>
            </div>
            {template.subject && (
              <p className='mt-0.5 truncate text-xs text-muted-foreground'>
                Subject: {template.subject}
              </p>
            )}
          </div>
          <Badge variant='outline' className={STATUS_BADGE_STYLES[template.status] || ''}>
            {template.status}
          </Badge>
        </div>

        {/* Preview Body */}
        <div className='mt-3'>
          {showPreview ? (
            <div className='rounded-md border bg-muted/50 p-2.5 text-xs text-muted-foreground'>
              <p className='whitespace-pre-wrap'>{previewBody}</p>
              {template.body.length > 200 && (
                <span className='text-[10px] text-muted-foreground'>...truncated</span>
              )}
            </div>
          ) : (
            <p className='line-clamp-2 text-xs text-muted-foreground'>{previewBody}</p>
          )}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className='mt-1 flex items-center gap-1 text-[11px] text-primary hover:underline'
          >
            <Eye className='size-3' />
            {showPreview ? 'Collapse' : 'Preview'}
          </button>
        </div>

        {/* Badges & Variables */}
        <div className='mt-3 flex flex-wrap items-center gap-1.5'>
          <Badge variant='outline' className={`text-[10px] ${CHANNEL_BADGE_STYLES[template.channel] || ''}`}>
            {template.channel}
          </Badge>
          <Badge variant='outline' className={`text-[10px] ${CATEGORY_BADGE_STYLES[template.category] || ''}`}>
            {template.category}
          </Badge>
          {template.variables.length > 0 && (
            <Badge variant='outline' className='text-[10px]'>
              <Code2 className='mr-1 size-2.5' />
              {template.variables.length} var{template.variables.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Variable list */}
        {template.variables.length > 0 && (
          <div className='mt-2 flex flex-wrap gap-1'>
            {template.variables.map((v) => (
              <span
                key={v}
                className='rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground'
              >
                {`{{${v}}}`}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className='mt-3 flex items-center justify-end gap-1'>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 px-2 text-xs'
            onClick={() => onEdit(template)}
          >
            <Pencil className='size-3' />
            Edit
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 px-2 text-xs text-destructive hover:text-destructive'
            onClick={() => onDelete(template)}
          >
            <Trash2 className='size-3' />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Template Form Dialog
// ============================================

function TemplateFormDialog({
  open,
  onOpenChange,
  template,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  template: Template | null
  onSuccess: () => void
}) {
  const isEdit = !!template

  const [name, setName] = useState('')
  const [channel, setChannel] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('DRAFT')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (template) {
      setName(template.name)
      setChannel(template.channel)
      setCategory(template.category)
      setStatus(template.status)
      setSubject(template.subject || '')
      setBody(template.body)
    } else {
      setName('')
      setChannel('')
      setCategory('')
      setStatus('DRAFT')
      setSubject('')
      setBody('')
    }
  }, [template, open])

  const handleSave = async () => {
    if (!name.trim() || !channel || !category || !body.trim()) {
      toast.error('Please fill in all required fields')
      return
    }
    try {
      setSaving(true)
      const payload = {
        name: name.trim(),
        channel,
        category,
        status,
        subject: subject.trim() || null,
        body: body.trim(),
      }
      if (isEdit) {
        await apiFetch(`/api/v1/communication/templates/${template!.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        toast.success('Template updated')
      } else {
        await apiFetch('/api/v1/communication/templates', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success('Template created')
      }
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save template'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Template' : 'Create Template'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the communication template.'
              : 'Create a new communication template.'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='tpl-name'>Name *</Label>
            <Input
              id='tpl-name'
              placeholder='e.g. Welcome Message'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label>Channel *</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger aria-label='Select channel'>
                  <SelectValue placeholder='Select channel' />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label>Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger aria-label='Select category'>
                  <SelectValue placeholder='Select category' />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_FORM_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='space-y-2'>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label='Select status'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='DRAFT'>Draft</SelectItem>
                <SelectItem value='ACTIVE'>Active</SelectItem>
                <SelectItem value='ARCHIVED'>Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(channel === 'EMAIL' || template?.channel === 'EMAIL') && (
            <div className='space-y-2'>
              <Label htmlFor='tpl-subject'>Subject</Label>
              <Input
                id='tpl-subject'
                placeholder='Email subject line'
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          )}

          <div className='space-y-2'>
            <Label htmlFor='tpl-body'>Body * <span className='text-muted-foreground font-normal'>(use {`{{variable}}`} for dynamic content)</span></Label>
            <Textarea
              id='tpl-body'
              placeholder='Hello {{name}}, welcome to {{company}}!'
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className='font-mono text-sm'
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Main Page
// ============================================

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dbUnavailable, setDbUnavailable] = useState(false)

  // Filters
  const [channelTab, setChannelTab] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  // Dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setDbUnavailable(false)

      const params = new URLSearchParams()
      if (channelTab) params.set('channel', channelTab)
      if (categoryFilter) params.set('category', categoryFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)

      const res = await apiFetch<TemplatesResponse>(
        `/api/v1/communication/templates?${params}`
      )
      setTemplates(res.data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load templates'
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
  }, [channelTab, categoryFilter, statusFilter, search])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleEdit = (t: Template) => {
    setEditingTemplate(t)
    setFormOpen(true)
  }

  const handleCreate = () => {
    setEditingTemplate(null)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await apiFetch(`/api/v1/communication/templates/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      toast.success('Template deleted')
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete template'
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  const hasActiveFilters = categoryFilter || statusFilter || search
  const clearFilters = () => {
    setCategoryFilter('')
    setStatusFilter('')
    setSearch('')
  }

  // ---- DB Unavailable State ----
  if (dbUnavailable && !templates.length) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Templates</h1>
          <p className='mt-1 text-muted-foreground'>Communication templates</p>
        </div>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertCircle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>Service Temporarily Unavailable</p>
            <p className='text-xs text-muted-foreground'>
              The database is not responding. This is usually a temporary issue.
            </p>
            <button
              onClick={fetchTemplates}
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
          <h1 className='text-2xl font-bold tracking-tight'>Templates</h1>
          <p className='mt-1 text-muted-foreground'>Manage communication templates</p>
        </div>
        <Button className='min-w-[140px]' onClick={handleCreate}>
          <Plus className='size-4' />
          Create Template
        </Button>
      </div>

      {/* Channel Tabs */}
      <div className='flex gap-1 overflow-x-auto rounded-lg border bg-muted/50 p-1'>
        {CHANNEL_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setChannelTab(tab.value)}
            className={cn(
              'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              channelTab === tab.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Search templates...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-9'
            aria-label='Search templates'
          />
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <div className='flex items-center gap-1.5 text-sm text-muted-foreground'>
            <Filter className='size-4' />
            <span className='hidden sm:inline'>Filters:</span>
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v === '_all' ? '' : v)}
          >
            <SelectTrigger className='w-[160px]' aria-label='Filter by category'>
              <SelectValue placeholder='All Categories' />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value || '_all'}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v === '_all' ? '' : v)}
          >
            <SelectTrigger className='w-[150px]' aria-label='Filter by status'>
              <SelectValue placeholder='All Statuses' />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value || '_all'}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant='ghost' size='sm' onClick={clearFilters}>
              <RotateCcw className='size-3' />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && !dbUnavailable && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-4'>
            <AlertCircle className='size-5 shrink-0 text-destructive' />
            <p className='flex-1 text-sm text-destructive'>{error}</p>
            <Button variant='outline' size='sm' onClick={fetchTemplates}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 6 }).map((_, i) => (
            <TemplateCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && templates.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <FileText className='mb-3 size-10 text-muted-foreground/50' />
            <p className='text-sm font-medium text-muted-foreground'>No templates created</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              {channelTab || hasActiveFilters
                ? 'Try adjusting your filters.'
                : 'Create your first communication template to get started.'}
            </p>
            {!channelTab && !hasActiveFilters && (
              <Button className='mt-4' size='sm' onClick={handleCreate}>
                <Plus className='size-4' />
                Create Template
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Template Cards */}
      {!loading && !error && templates.length > 0 && (
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {templates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <TemplateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        template={editingTemplate}
        onSuccess={fetchTemplates}
      />

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
