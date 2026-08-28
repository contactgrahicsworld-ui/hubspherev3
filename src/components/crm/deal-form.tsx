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
import { DEAL_STAGES } from '@/lib/constants'

// ============================================
// Types
// ============================================

interface UserOption {
  id: string
  name: string
  email: string
}

interface ContactOption {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
}

interface CompanyOption {
  id: string
  name: string
}

export interface DealFormData {
  title: string
  value: string
  currency: string
  stage: string
  probability: string
  expectedCloseDate: string
  contactId: string
  companyId: string
  ownerId: string
  lostReason: string
  notes: string
}

export interface DealFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deal?: {
    id: string
    title: string
    value: number | null
    currency: string | null
    stage: string | null
    probability: number | null
    expectedCloseDate: string | null
    contactId: string | null
    companyId: string | null
    ownerId: string | null
    lostReason: string | null
    notes: string | null
  } | null
  onSuccess?: () => void
}

// ============================================
// Validation
// ============================================

const dealSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500),
  value: z.number().min(0).optional(),
  currency: z.string().trim().max(10).optional(),
  stage: z.string().trim().max(50).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  contactId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  lostReason: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
})

// ============================================
// Default Form Data
// ============================================

const emptyForm: DealFormData = {
  title: '',
  value: '',
  currency: 'INR',
  stage: 'NEW',
  probability: '',
  expectedCloseDate: '',
  contactId: '',
  companyId: '',
  ownerId: '',
  lostReason: '',
  notes: '',
}

// ============================================
// Component
// ============================================

export function DealFormDialog({ open, onOpenChange, deal, onSuccess }: DealFormProps) {
  const isEdit = !!deal?.id
  const [form, setForm] = useState<DealFormData>(emptyForm)
  const [users, setUsers] = useState<UserOption[]>([])
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [errors, setErrors] = useState<Partial<Record<keyof DealFormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(false)

  useEffect(() => {
    if (open) {
      if (deal) {
        setForm({
          title: deal.title ?? '',
          value: deal.value != null ? String(deal.value) : '',
          currency: deal.currency ?? 'INR',
          stage: deal.stage ?? 'NEW',
          probability: deal.probability != null ? String(deal.probability) : '',
          expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.split('T')[0] : '',
          contactId: deal.contactId ?? '',
          companyId: deal.companyId ?? '',
          ownerId: deal.ownerId ?? '',
          lostReason: deal.lostReason ?? '',
          notes: deal.notes ?? '',
        })
      } else {
        setForm(emptyForm)
      }
      setErrors({})
      fetchOptions()
    }
  }, [open, deal])

  const fetchOptions = async () => {
    setLoadingOptions(true)
    try {
      const [usersRes, contactsRes, companiesRes] = await Promise.all([
        apiFetch<{ success: boolean; data: UserOption[] }>('/api/v1/admin/users?limit=100'),
        apiFetch<{ success: boolean; data: ContactOption[] }>('/api/v1/crm/contacts?limit=100'),
        apiFetch<{ success: boolean; data: CompanyOption[] }>('/api/v1/crm/companies?limit=100'),
      ])
      setUsers(usersRes.data ?? [])
      setContacts(contactsRes.data ?? [])
      setCompanies(companiesRes.data ?? [])
    } catch { /* silent */ } finally {
      setLoadingOptions(false)
    }
  }

  const handleChange = (field: keyof DealFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})

    const payload: Record<string, unknown> = { title: form.title }
    if (form.value) { const n = Number(form.value); if (!isNaN(n)) payload.value = n }
    if (form.currency) payload.currency = form.currency
    if (form.stage) payload.stage = form.stage
    if (form.probability) { const n = Number(form.probability); if (!isNaN(n)) payload.probability = n }
    if (form.expectedCloseDate) payload.expectedCloseDate = new Date(form.expectedCloseDate).toISOString()
    if (form.contactId) payload.contactId = form.contactId
    if (form.companyId) payload.companyId = form.companyId
    if (form.ownerId) payload.ownerId = form.ownerId
    if (form.stage === 'LOST' && form.lostReason) payload.lostReason = form.lostReason
    if (form.notes) payload.notes = form.notes

    const result = dealSchema.safeParse(payload)
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof DealFormData, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof DealFormData
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    try {
      setSubmitting(true)
      if (isEdit) {
        await apiFetch(`/api/v1/crm/deals/${deal.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        toast.success('Deal updated successfully')
      } else {
        await apiFetch('/api/v1/crm/deals', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast.success('Deal created successfully')
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

  const showLostReason = form.stage === 'LOST'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Deal' : 'Create Deal'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the deal information below.' : 'Fill in the details to create a new deal.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Title */}
          <div className='space-y-2'>
            <Label htmlFor='deal-title'>
              Title <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='deal-title'
              placeholder='Enterprise SaaS License'
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              aria-invalid={!!errors.title}
              aria-required='true'
            />
            {errors.title && <p className='text-xs text-destructive'>{errors.title}</p>}
          </div>

          {/* Value, Currency, Stage */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
            <div className='space-y-2'>
              <Label htmlFor='deal-value'>Value</Label>
              <Input
                id='deal-value'
                type='number'
                min='0'
                step='0.01'
                placeholder='0'
                value={form.value}
                onChange={(e) => handleChange('value', e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='deal-currency'>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => handleChange('currency', v)}>
                <SelectTrigger id='deal-currency'><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='INR'>INR</SelectItem>
                  <SelectItem value='USD'>USD</SelectItem>
                  <SelectItem value='EUR'>EUR</SelectItem>
                  <SelectItem value='GBP'>GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='deal-stage'>Stage</Label>
              <Select value={form.stage} onValueChange={(v) => handleChange('stage', v)}>
                <SelectTrigger id='deal-stage'><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEAL_STAGES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Probability, Expected Close */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='deal-probability'>Probability (0-100)</Label>
              <Input
                id='deal-probability'
                type='number'
                min='0'
                max='100'
                placeholder='0'
                value={form.probability}
                onChange={(e) => handleChange('probability', e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='deal-closeDate'>Expected Close</Label>
              <Input
                id='deal-closeDate'
                type='date'
                value={form.expectedCloseDate}
                onChange={(e) => handleChange('expectedCloseDate', e.target.value)}
              />
            </div>
          </div>

          {/* Contact, Company */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='deal-contact'>Contact</Label>
              <Select value={form.contactId} onValueChange={(v) => handleChange('contactId', v)}>
                <SelectTrigger id='deal-contact'>
                  <SelectValue placeholder={loadingOptions ? 'Loading...' : 'Select contact'} />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {[c.firstName, c.lastName].filter(Boolean).join(' ')}{c.email ? ` (${c.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='deal-company'>Company</Label>
              <Select value={form.companyId} onValueChange={(v) => handleChange('companyId', v)}>
                <SelectTrigger id='deal-company'>
                  <SelectValue placeholder={loadingOptions ? 'Loading...' : 'Select company'} />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Owner */}
          <div className='space-y-2'>
            <Label htmlFor='deal-owner'>Owner</Label>
            <Select value={form.ownerId} onValueChange={(v) => handleChange('ownerId', v)}>
              <SelectTrigger id='deal-owner'>
                <SelectValue placeholder={loadingOptions ? 'Loading...' : 'Select owner'} />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lost Reason (only when LOST) */}
          {showLostReason && (
            <div className='space-y-2'>
              <Label htmlFor='deal-lostReason'>Lost Reason</Label>
              <Input
                id='deal-lostReason'
                placeholder='Why was this deal lost?'
                value={form.lostReason}
                onChange={(e) => handleChange('lostReason', e.target.value)}
              />
            </div>
          )}

          {/* Notes */}
          <div className='space-y-2'>
            <Label htmlFor='deal-notes'>Notes</Label>
            <Textarea
              id='deal-notes'
              placeholder='Add any notes about this deal...'
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter className='gap-2 pt-2'>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type='submit' disabled={submitting || !form.title.trim()}>
              {submitting ? (
                <>
                  <Loader2 className='size-4 animate-spin' />
                  {isEdit ? 'Updating...' : 'Creating...'}
                </>
              ) : isEdit ? (
                'Update Deal'
              ) : (
                'Create Deal'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
