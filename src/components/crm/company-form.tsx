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

export interface CompanyFormData {
  name: string
  industry: string
  website: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  country: string
  ownerId: string
}

export interface CompanyFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  company?: {
    id: string
    name: string
    industry: string | null
    website: string | null
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    state: string | null
    country: string | null
    ownerId: string | null
  } | null
  onSuccess?: () => void
}

// ============================================
// Validation
// ============================================

const companySchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(300),
  industry: z.string().trim().max(200).optional(),
  website: z.string().trim().max(500).optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional(),
  address: z.string().max(1000).optional(),
  city: z.string().trim().max(200).optional(),
  state: z.string().trim().max(200).optional(),
  country: z.string().trim().max(200).optional(),
  ownerId: z.string().uuid().optional(),
})

// ============================================
// Default Form Data
// ============================================

const emptyForm: CompanyFormData = {
  name: '',
  industry: '',
  website: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  country: '',
  ownerId: '',
}

// ============================================
// Component
// ============================================

export function CompanyFormDialog({ open, onOpenChange, company, onSuccess }: CompanyFormProps) {
  const isEdit = !!company?.id
  const [form, setForm] = useState<CompanyFormData>(emptyForm)
  const [users, setUsers] = useState<UserOption[]>([])
  const [errors, setErrors] = useState<Partial<Record<keyof CompanyFormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)

  useEffect(() => {
    if (open) {
      if (company) {
        setForm({
          name: company.name ?? '',
          industry: company.industry ?? '',
          website: company.website ?? '',
          email: company.email ?? '',
          phone: company.phone ?? '',
          address: company.address ?? '',
          city: company.city ?? '',
          state: company.state ?? '',
          country: company.country ?? '',
          ownerId: company.ownerId ?? '',
        })
      } else {
        setForm(emptyForm)
      }
      setErrors({})
      fetchUsers()
    }
  }, [open, company])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const res = await apiFetch<{ success: boolean; data: UserOption[] }>(
        '/api/v1/admin/users?limit=100'
      )
      setUsers(res.data ?? [])
    } catch {
      // silent
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleChange = (field: keyof CompanyFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})

    const payload: Record<string, unknown> = { name: form.name }
    if (form.industry) payload.industry = form.industry
    if (form.website) payload.website = form.website
    if (form.email) payload.email = form.email
    if (form.phone) payload.phone = form.phone
    if (form.address) payload.address = form.address
    if (form.city) payload.city = form.city
    if (form.state) payload.state = form.state
    if (form.country) payload.country = form.country
    if (form.ownerId) payload.ownerId = form.ownerId

    const result = companySchema.safeParse(payload)
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof CompanyFormData, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CompanyFormData
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    try {
      setSubmitting(true)
      if (isEdit) {
        await apiFetch(`/api/v1/crm/companies/${company.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        toast.success('Company updated successfully')
      } else {
        await apiFetch('/api/v1/crm/companies', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success('Company created successfully')
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
          <DialogTitle>{isEdit ? 'Edit Company' : 'Create Company'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the company information below.'
              : 'Fill in the details to create a new company.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Name */}
          <div className='space-y-2'>
            <Label htmlFor='company-name'>
              Company Name <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='company-name'
              placeholder='Acme Inc.'
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              aria-invalid={!!errors.name}
              aria-required='true'
            />
            {errors.name && <p className='text-xs text-destructive'>{errors.name}</p>}
          </div>

          {/* Industry */}
          <div className='space-y-2'>
            <Label htmlFor='company-industry'>Industry</Label>
            <Input
              id='company-industry'
              placeholder='Technology'
              value={form.industry}
              onChange={(e) => handleChange('industry', e.target.value)}
            />
          </div>

          {/* Website */}
          <div className='space-y-2'>
            <Label htmlFor='company-website'>Website</Label>
            <Input
              id='company-website'
              placeholder='https://acme.com'
              value={form.website}
              onChange={(e) => handleChange('website', e.target.value)}
            />
          </div>

          {/* Email & Phone */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='company-email'>Email</Label>
              <Input
                id='company-email'
                type='email'
                placeholder='info@acme.com'
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className='text-xs text-destructive'>{errors.email}</p>}
            </div>
            <div className='space-y-2'>
              <Label htmlFor='company-phone'>Phone</Label>
              <Input
                id='company-phone'
                placeholder='+1 234 567 8900'
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
          </div>

          {/* Address */}
          <div className='space-y-2'>
            <Label htmlFor='company-address'>Address</Label>
            <Textarea
              id='company-address'
              placeholder='123 Business St, Suite 100'
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              rows={2}
            />
          </div>

          {/* City, State, Country */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
            <div className='space-y-2'>
              <Label htmlFor='company-city'>City</Label>
              <Input
                id='company-city'
                placeholder='Mumbai'
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='company-state'>State</Label>
              <Input
                id='company-state'
                placeholder='Maharashtra'
                value={form.state}
                onChange={(e) => handleChange('state', e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='company-country'>Country</Label>
              <Input
                id='company-country'
                placeholder='India'
                value={form.country}
                onChange={(e) => handleChange('country', e.target.value)}
              />
            </div>
          </div>

          {/* Owner */}
          <div className='space-y-2'>
            <Label htmlFor='company-owner'>Owner</Label>
            <Select value={form.ownerId} onValueChange={(v) => handleChange('ownerId', v)}>
              <SelectTrigger id='company-owner'>
                <SelectValue placeholder={loadingUsers ? 'Loading...' : 'Select owner'} />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
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
            <Button type='submit' disabled={submitting || !form.name.trim()}>
              {submitting ? (
                <>
                  <Loader2 className='size-4 animate-spin' />
                  {isEdit ? 'Updating...' : 'Creating...'}
                </>
              ) : isEdit ? (
                'Update Company'
              ) : (
                'Create Company'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
