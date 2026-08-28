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
import { LEAD_SOURCES } from '@/lib/constants'
import { z } from 'zod'

// ============================================
// Types
// ============================================

interface UserOption {
  id: string
  name: string
  email: string
}

export interface LeadFormData {
  firstName: string
  lastName: string
  email: string
  mobile: string
  company: string
  source: string
  priority: string
  ownerId: string
  value: string
  description: string
}

export interface LeadFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead?: {
    id: string
    firstName: string
    lastName: string | null
    email: string | null
    mobile: string | null
    company: string | null
    source: string | null
    priority: string | null
    ownerId: string | null
    value: number | null
    description: string | null
  } | null
  onSuccess?: () => void
}

// ============================================
// Validation
// ============================================

const leadSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(200),
  lastName: z.string().trim().max(200).optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  mobile: z.string().trim().max(30).optional(),
  company: z.string().trim().max(300).optional(),
  source: z.string().trim().max(50).optional(),
  priority: z.string().trim().max(20).optional(),
  ownerId: z.string().uuid().optional(),
  value: z.number().min(0).optional(),
  description: z.string().max(5000).optional(),
})

// ============================================
// Default Form Data
// ============================================

const emptyForm: LeadFormData = {
  firstName: '',
  lastName: '',
  email: '',
  mobile: '',
  company: '',
  source: 'OTHER',
  priority: 'MEDIUM',
  ownerId: '',
  value: '',
  description: '',
}

// ============================================
// Source / Priority Labels
// ============================================

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: 'Website',
  REFERRAL: 'Referral',
  LINKEDIN: 'LinkedIn',
  COLD_CALL: 'Cold Call',
  EMAIL_CAMPAIGN: 'Email Campaign',
  ADVERTISEMENT: 'Advertisement',
  TRADE_SHOW: 'Trade Show',
  SOCIAL_MEDIA: 'Social Media',
  OTHER: 'Other',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
}

// ============================================
// Component
// ============================================

export function LeadFormDialog({ open, onOpenChange, lead, onSuccess }: LeadFormProps) {
  const isEdit = !!lead?.id
  const [form, setForm] = useState<LeadFormData>(emptyForm)
  const [users, setUsers] = useState<UserOption[]>([])
  const [errors, setErrors] = useState<Partial<Record<keyof LeadFormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Populate form when editing
  useEffect(() => {
    if (open) {
      if (lead) {
        setForm({
          firstName: lead.firstName ?? '',
          lastName: lead.lastName ?? '',
          email: lead.email ?? '',
          mobile: lead.mobile ?? '',
          company: lead.company ?? '',
          source: lead.source ?? 'OTHER',
          priority: lead.priority ?? 'MEDIUM',
          ownerId: lead.ownerId ?? '',
          value: lead.value != null ? String(lead.value) : '',
          description: lead.description ?? '',
        })
      } else {
        setForm(emptyForm)
      }
      setErrors({})
      fetchUsers()
    }
  }, [open, lead])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const res = await apiFetch<{ success: boolean; data: UserOption[] }>(
        '/api/v1/admin/users?limit=100'
      )
      setUsers(res.data ?? [])
    } catch {
      // Silently fail - owner select will just be empty
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleChange = (field: keyof LeadFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})

    // Build payload for validation
    const payload: Record<string, unknown> = {
      firstName: form.firstName,
    }
    if (form.lastName) payload.lastName = form.lastName
    if (form.email) payload.email = form.email
    if (form.mobile) payload.mobile = form.mobile
    if (form.company) payload.company = form.company
    if (form.source) payload.source = form.source
    if (form.priority) payload.priority = form.priority
    if (form.ownerId) payload.ownerId = form.ownerId
    if (form.value) {
      const numVal = Number(form.value)
      if (!isNaN(numVal)) payload.value = numVal
    }
    if (form.description) payload.description = form.description

    const result = leadSchema.safeParse(payload)
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof LeadFormData, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof LeadFormData
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    try {
      setSubmitting(true)

      if (isEdit) {
        await apiFetch(`/api/v1/crm/leads/${lead.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        toast.success('Lead updated successfully')
      } else {
        await apiFetch('/api/v1/crm/leads', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success('Lead created successfully')
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
          <DialogTitle>{isEdit ? 'Edit Lead' : 'Create Lead'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the lead information below.'
              : 'Fill in the details to create a new lead.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* First Name */}
          <div className='space-y-2'>
            <Label htmlFor='lead-firstName'>
              First Name <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='lead-firstName'
              placeholder='John'
              value={form.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              aria-invalid={!!errors.firstName}
              aria-required='true'
            />
            {errors.firstName && (
              <p className='text-xs text-destructive'>{errors.firstName}</p>
            )}
          </div>

          {/* Last Name */}
          <div className='space-y-2'>
            <Label htmlFor='lead-lastName'>Last Name</Label>
            <Input
              id='lead-lastName'
              placeholder='Doe'
              value={form.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
            />
          </div>

          {/* Email & Mobile */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='lead-email'>Email</Label>
              <Input
                id='lead-email'
                type='email'
                placeholder='john@example.com'
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className='text-xs text-destructive'>{errors.email}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='lead-mobile'>Mobile</Label>
              <Input
                id='lead-mobile'
                placeholder='+1 234 567 8900'
                value={form.mobile}
                onChange={(e) => handleChange('mobile', e.target.value)}
              />
            </div>
          </div>

          {/* Company */}
          <div className='space-y-2'>
            <Label htmlFor='lead-company'>Company</Label>
            <Input
              id='lead-company'
              placeholder='Acme Inc.'
              value={form.company}
              onChange={(e) => handleChange('company', e.target.value)}
            />
          </div>

          {/* Source & Priority */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='lead-source'>Source</Label>
              <Select value={form.source} onValueChange={(v) => handleChange('source', v)}>
                <SelectTrigger id='lead-source'>
                  <SelectValue placeholder='Select source' />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='lead-priority'>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => handleChange('priority', v)}>
                <SelectTrigger id='lead-priority'>
                  <SelectValue placeholder='Select priority' />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Owner */}
          <div className='space-y-2'>
            <Label htmlFor='lead-owner'>Owner</Label>
            <Select value={form.ownerId} onValueChange={(v) => handleChange('ownerId', v)}>
              <SelectTrigger id='lead-owner'>
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

          {/* Value */}
          <div className='space-y-2'>
            <Label htmlFor='lead-value'>Deal Value</Label>
            <Input
              id='lead-value'
              type='number'
              min='0'
              step='0.01'
              placeholder='0.00'
              value={form.value}
              onChange={(e) => handleChange('value', e.target.value)}
            />
          </div>

          {/* Description */}
          <div className='space-y-2'>
            <Label htmlFor='lead-description'>Description</Label>
            <Textarea
              id='lead-description'
              placeholder='Add any notes about this lead...'
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
            />
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
            <Button type='submit' disabled={submitting || !form.firstName.trim()}>
              {submitting ? (
                <>
                  <Loader2 className='size-4 animate-spin' />
                  {isEdit ? 'Updating...' : 'Creating...'}
                </>
              ) : isEdit ? (
                'Update Lead'
              ) : (
                'Create Lead'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
