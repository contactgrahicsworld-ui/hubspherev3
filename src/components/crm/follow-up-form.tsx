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

export interface FollowUpFormData {
  title: string
  description: string
  followUpDate: string
  entityType: string
  entityId: string
  ownerId: string
}

export interface FollowUpFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  followUp?: {
    id: string
    title: string
    description: string | null
    followUpDate: string | null
    entityType: string | null
    entityId: string | null
    ownerId: string | null
  } | null
  onSuccess?: () => void
}

// ============================================
// Validation
// ============================================

const followUpSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional(),
  followUpDate: z.string().min(1, 'Follow-up date is required'),
  entityType: z.string().trim().max(50).optional(),
  entityId: z.string().trim().optional(),
  ownerId: z.string().uuid().optional(),
})

// ============================================
// Constants
// ============================================

const EMPTY_FORM: FollowUpFormData = {
  title: '',
  description: '',
  followUpDate: '',
  entityType: '',
  entityId: '',
  ownerId: '',
}

const ENTITY_TYPE_OPTIONS = [
  { value: 'LEAD', label: 'Lead' },
  { value: 'CONTACT', label: 'Contact' },
  { value: 'DEAL', label: 'Deal' },
]

// ============================================
// Component
// ============================================

export function FollowUpFormDialog({ open, onOpenChange, followUp, onSuccess }: FollowUpFormProps) {
  const isEdit = !!followUp?.id
  const [form, setForm] = useState<FollowUpFormData>(EMPTY_FORM)
  const [users, setUsers] = useState<UserOption[]>([])
  const [errors, setErrors] = useState<Partial<Record<keyof FollowUpFormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)

  useEffect(() => {
    if (open) {
      if (followUp) {
        setForm({
          title: followUp.title ?? '',
          description: followUp.description ?? '',
          followUpDate: followUp.followUpDate
            ? followUp.followUpDate.slice(0, 16)
            : '',
          entityType: followUp.entityType ?? '',
          entityId: followUp.entityId ?? '',
          ownerId: followUp.ownerId ?? '',
        })
      } else {
        setForm(EMPTY_FORM)
      }
      setErrors({})
      fetchUsers()
    }
  }, [open, followUp])

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

  const handleChange = (field: keyof FollowUpFormData, value: string) => {
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
      followUpDate: form.followUpDate,
    }
    if (form.description.trim()) payload.description = form.description.trim()
    if (form.entityType) payload.entityType = form.entityType
    if (form.entityId) payload.entityId = form.entityId
    if (form.ownerId) payload.ownerId = form.ownerId

    const result = followUpSchema.safeParse(payload)
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof FollowUpFormData, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FollowUpFormData
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    try {
      setSubmitting(true)

      if (isEdit) {
        await apiFetch(`/api/v1/crm/follow-ups/${followUp.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        toast.success('Follow-up updated successfully')
      } else {
        await apiFetch('/api/v1/crm/follow-ups', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success('Follow-up created successfully')
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
          <DialogTitle>{isEdit ? 'Edit Follow-up' : 'Create Follow-up'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the follow-up details below.'
              : 'Schedule a new follow-up.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Title */}
          <div className='space-y-2'>
            <Label htmlFor='fu-title'>
              Title <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='fu-title'
              placeholder='Follow-up title...'
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
            <Label htmlFor='fu-description'>Description</Label>
            <Textarea
              id='fu-description'
              placeholder='Add notes...'
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
            />
          </div>

          {/* Follow-up Date */}
          <div className='space-y-2'>
            <Label htmlFor='fu-date'>
              Follow-up Date & Time <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='fu-date'
              type='datetime-local'
              value={form.followUpDate}
              onChange={(e) => handleChange('followUpDate', e.target.value)}
              aria-invalid={!!errors.followUpDate}
              aria-required='true'
            />
            {errors.followUpDate && (
              <p className='text-xs text-destructive'>{errors.followUpDate}</p>
            )}
          </div>

          {/* Entity Type & Entity ID */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='fu-entityType'>Linked Entity</Label>
              <Select
                value={form.entityType}
                onValueChange={(v) => handleChange('entityType', v)}
              >
                <SelectTrigger id='fu-entityType'>
                  <SelectValue placeholder='Select type' />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='fu-entityId'>Entity ID</Label>
              <Input
                id='fu-entityId'
                placeholder='Enter entity ID...'
                value={form.entityId}
                onChange={(e) => handleChange('entityId', e.target.value)}
                disabled={!form.entityType}
              />
            </div>
          </div>

          {/* Owner */}
          <div className='space-y-2'>
            <Label htmlFor='fu-owner'>Owner</Label>
            <Select value={form.ownerId} onValueChange={(v) => handleChange('ownerId', v)}>
              <SelectTrigger id='fu-owner'>
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
            <Button type='submit' disabled={submitting || !form.title.trim() || !form.followUpDate}>
              {submitting ? (
                <>
                  <Loader2 className='size-4 animate-spin' />
                  {isEdit ? 'Updating...' : 'Creating...'}
                </>
              ) : isEdit ? (
                'Update Follow-up'
              ) : (
                'Create Follow-up'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
