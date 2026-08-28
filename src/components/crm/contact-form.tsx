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

interface CompanyOption {
  id: string
  name: string
}

export interface ContactFormData {
  firstName: string
  lastName: string
  email: string
  mobile: string
  phone: string
  title: string
  companyId: string
  ownerId: string
}

export interface ContactFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact?: {
    id: string
    firstName: string
    lastName: string | null
    email: string | null
    mobile: string | null
    phone: string | null
    title: string | null
    companyId: string | null
    ownerId: string | null
  } | null
  onSuccess?: () => void
}

// ============================================
// Validation
// ============================================

const contactSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(200),
  lastName: z.string().trim().max(200).optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  mobile: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(30).optional(),
  title: z.string().trim().max(200).optional(),
  companyId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
})

// ============================================
// Default Form Data
// ============================================

const emptyForm: ContactFormData = {
  firstName: '',
  lastName: '',
  email: '',
  mobile: '',
  phone: '',
  title: '',
  companyId: '',
  ownerId: '',
}

// ============================================
// Component
// ============================================

export function ContactFormDialog({ open, onOpenChange, contact, onSuccess }: ContactFormProps) {
  const isEdit = !!contact?.id
  const [form, setForm] = useState<ContactFormData>(emptyForm)
  const [users, setUsers] = useState<UserOption[]>([])
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(false)

  useEffect(() => {
    if (open) {
      if (contact) {
        setForm({
          firstName: contact.firstName ?? '',
          lastName: contact.lastName ?? '',
          email: contact.email ?? '',
          mobile: contact.mobile ?? '',
          phone: contact.phone ?? '',
          title: contact.title ?? '',
          companyId: contact.companyId ?? '',
          ownerId: contact.ownerId ?? '',
        })
      } else {
        setForm(emptyForm)
      }
      setErrors({})
      fetchOptions()
    }
  }, [open, contact])

  const fetchOptions = async () => {
    setLoadingOptions(true)
    try {
      const [usersRes, companiesRes] = await Promise.all([
        apiFetch<{ success: boolean; data: UserOption[] }>('/api/v1/admin/users?limit=100'),
        apiFetch<{ success: boolean; data: CompanyOption[]; pagination: { total: number } }>(
          '/api/v1/crm/companies?limit=100'
        ),
      ])
      setUsers(usersRes.data ?? [])
      setCompanies(companiesRes.data ?? [])
    } catch {
      // Silently fail - selects will be empty
    } finally {
      setLoadingOptions(false)
    }
  }

  const handleChange = (field: keyof ContactFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})

    const payload: Record<string, unknown> = { firstName: form.firstName }
    if (form.lastName) payload.lastName = form.lastName
    if (form.email) payload.email = form.email
    if (form.mobile) payload.mobile = form.mobile
    if (form.phone) payload.phone = form.phone
    if (form.title) payload.title = form.title
    if (form.companyId) payload.companyId = form.companyId
    if (form.ownerId) payload.ownerId = form.ownerId

    const result = contactSchema.safeParse(payload)
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ContactFormData, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof ContactFormData
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    try {
      setSubmitting(true)
      if (isEdit) {
        await apiFetch(`/api/v1/crm/contacts/${contact.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        toast.success('Contact updated successfully')
      } else {
        await apiFetch('/api/v1/crm/contacts', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success('Contact created successfully')
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
          <DialogTitle>{isEdit ? 'Edit Contact' : 'Create Contact'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the contact information below.'
              : 'Fill in the details to create a new contact.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* First Name */}
          <div className='space-y-2'>
            <Label htmlFor='contact-firstName'>
              First Name <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='contact-firstName'
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
            <Label htmlFor='contact-lastName'>Last Name</Label>
            <Input
              id='contact-lastName'
              placeholder='Doe'
              value={form.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
            />
          </div>

          {/* Title */}
          <div className='space-y-2'>
            <Label htmlFor='contact-title'>Title</Label>
            <Input
              id='contact-title'
              placeholder='VP of Engineering'
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
            />
          </div>

          {/* Email */}
          <div className='space-y-2'>
            <Label htmlFor='contact-email'>Email</Label>
            <Input
              id='contact-email'
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

          {/* Mobile & Phone */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='contact-mobile'>Mobile</Label>
              <Input
                id='contact-mobile'
                placeholder='+1 234 567 8900'
                value={form.mobile}
                onChange={(e) => handleChange('mobile', e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='contact-phone'>Phone</Label>
              <Input
                id='contact-phone'
                placeholder='+1 234 567 8901'
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
          </div>

          {/* Company */}
          <div className='space-y-2'>
            <Label htmlFor='contact-company'>Company</Label>
            <Select value={form.companyId} onValueChange={(v) => handleChange('companyId', v)}>
              <SelectTrigger id='contact-company'>
                <SelectValue placeholder={loadingOptions ? 'Loading...' : 'Select company'} />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Owner */}
          <div className='space-y-2'>
            <Label htmlFor='contact-owner'>Owner</Label>
            <Select value={form.ownerId} onValueChange={(v) => handleChange('ownerId', v)}>
              <SelectTrigger id='contact-owner'>
                <SelectValue placeholder={loadingOptions ? 'Loading...' : 'Select owner'} />
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
            <Button type='submit' disabled={submitting || !form.firstName.trim()}>
              {submitting ? (
                <>
                  <Loader2 className='size-4 animate-spin' />
                  {isEdit ? 'Updating...' : 'Creating...'}
                </>
              ) : isEdit ? (
                'Update Contact'
              ) : (
                'Create Contact'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
