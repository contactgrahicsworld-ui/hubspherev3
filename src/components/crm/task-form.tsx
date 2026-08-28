'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
import { Loader2 } from 'lucide-react'
import { z } from 'zod'

// ============================================
// Types
// ============================================

interface UserOption {
  id: string
  name: string
  email: string
}

export interface TaskFormData {
  title: string
  description: string
  status: string
  priority: string
  dueDate: string
  entityType: string
  entityId: string
  ownerId: string
}

export interface TaskFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: {
    id: string
    title: string
    description: string | null
    status: string | null
    priority: string | null
    dueDate: string | null
    entityType: string | null
    entityId: string | null
    ownerId: string | null
  } | null
  onSuccess?: () => void
}

// ============================================
// Validation
// ============================================

const taskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional(),
  status: z.string().trim().max(50).optional(),
  priority: z.string().trim().max(20).optional(),
  dueDate: z.string().optional(),
  entityType: z.string().trim().max(50).optional(),
  entityId: z.string().trim().optional(),
  ownerId: z.string().uuid().optional(),
})

// ============================================
// Constants
// ============================================

const EMPTY_FORM: TaskFormData = {
  title: '',
  description: '',
  status: 'TODO',
  priority: 'MEDIUM',
  dueDate: '',
  entityType: '',
  entityId: '',
  ownerId: '',
}

const STATUS_OPTIONS = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'LEAD', label: 'Lead' },
  { value: 'CONTACT', label: 'Contact' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'DEAL', label: 'Deal' },
]

// ============================================
// Component
// ============================================

export function TaskFormDialog({ open, onOpenChange, task, onSuccess }: TaskFormProps) {
  const isEdit = !!task?.id
  const [form, setForm] = useState<TaskFormData>(EMPTY_FORM)
  const [users, setUsers] = useState<UserOption[]>([])
  const [errors, setErrors] = useState<Partial<Record<keyof TaskFormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)

  useEffect(() => {
    if (open) {
      if (task) {
        setForm({
          title: task.title ?? '',
          description: task.description ?? '',
          status: task.status ?? 'TODO',
          priority: task.priority ?? 'MEDIUM',
          dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
          entityType: task.entityType ?? '',
          entityId: task.entityId ?? '',
          ownerId: task.ownerId ?? '',
        })
      } else {
        setForm(EMPTY_FORM)
      }
      setErrors({})
      fetchUsers()
    }
  }, [open, task])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const res = await apiFetch<{ success: boolean; data: UserOption[] }>(
        '/api/v1/admin/users?limit=100'
      )
      setUsers(res.data ?? [])
    } catch {
      // Silently fail
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleChange = (field: keyof TaskFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
    }
    if (form.description.trim()) payload.description = form.description.trim()
    if (form.status) payload.status = form.status
    if (form.priority) payload.priority = form.priority
    if (form.dueDate) payload.dueDate = form.dueDate
    if (form.entityType) payload.entityType = form.entityType
    if (form.entityId) payload.entityId = form.entityId
    if (form.ownerId) payload.ownerId = form.ownerId

    const result = taskSchema.safeParse(payload)
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof TaskFormData, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof TaskFormData
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    try {
      setSubmitting(true)

      if (isEdit) {
        await apiFetch(`/api/v1/crm/tasks/${task.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        toast.success('Task updated successfully')
      } else {
        await apiFetch('/api/v1/crm/tasks', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success('Task created successfully')
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Task' : 'Create Task'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the task details below.'
              : 'Fill in the details to create a new task.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Title */}
          <div className='space-y-2'>
            <Label htmlFor='task-title'>
              Title <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='task-title'
              placeholder='Enter task title...'
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              aria-invalid={!!errors.title}
              aria-required='true'
            />
            {errors.title && (
              <p className='text-xs text-destructive'>{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div className='space-y-2'>
            <Label htmlFor='task-description'>Description</Label>
            <Textarea
              id='task-description'
              placeholder='Add task description...'
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
            />
          </div>

          {/* Status & Priority */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='task-status'>Status</Label>
              <Select value={form.status} onValueChange={(v) => handleChange('status', v)}>
                <SelectTrigger id='task-status'>
                  <SelectValue placeholder='Select status' />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='task-priority'>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => handleChange('priority', v)}>
                <SelectTrigger id='task-priority'>
                  <SelectValue placeholder='Select priority' />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date */}
          <div className='space-y-2'>
            <Label htmlFor='task-dueDate'>Due Date</Label>
            <Input
              id='task-dueDate'
              type='date'
              value={form.dueDate}
              onChange={(e) => handleChange('dueDate', e.target.value)}
            />
          </div>

          {/* Entity Type & Entity ID */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='task-entityType'>Linked Entity</Label>
              <Select
                value={form.entityType}
                onValueChange={(v) => handleChange('entityType', v)}
              >
                <SelectTrigger id='task-entityType'>
                  <SelectValue placeholder='Select type' />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value || '_none'} value={opt.value || '_none'}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='task-entityId'>Entity ID</Label>
              <Input
                id='task-entityId'
                placeholder='Enter entity ID...'
                value={form.entityId}
                onChange={(e) => handleChange('entityId', e.target.value)}
                disabled={!form.entityType || form.entityType === '_none'}
              />
            </div>
          </div>

          {/* Owner */}
          <div className='space-y-2'>
            <Label htmlFor='task-owner'>Owner</Label>
            <Select value={form.ownerId} onValueChange={(v) => handleChange('ownerId', v)}>
              <SelectTrigger id='task-owner'>
                <SelectValue placeholder={loadingUsers ? 'Loading...' : 'Select owner'} />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className='gap-2 pt-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={submitting || !form.title.trim()}>
              {submitting ? (
                <>
                  <Loader2 className='size-4 animate-spin' />
                  {isEdit ? 'Updating...' : 'Creating...'}
                </>
              ) : isEdit ? (
                'Update Task'
              ) : (
                'Create Task'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
