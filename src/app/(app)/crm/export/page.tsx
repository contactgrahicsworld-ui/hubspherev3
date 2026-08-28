'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Download, Loader2, AlertCircle } from 'lucide-react'
import { getAccessToken } from '@/lib/auth-client'
import { LEAD_STATUSES, DEAL_STAGES } from '@/lib/constants'

// ============================================
// Entity type options
// ============================================

const ENTITY_OPTIONS = [
  { value: 'leads', label: 'Leads' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'companies', label: 'Companies' },
  { value: 'deals', label: 'Deals' },
] as const

// ============================================
// Main Page
// ============================================

export default function ExportPage() {
  const [entityType, setEntityType] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showStatusFilter = entityType === 'leads' || entityType === 'deals'
  const statusOptions = entityType === 'deals'
    ? DEAL_STAGES.map((s) => ({ value: s.key, label: s.label }))
    : Object.values(LEAD_STATUSES).map((s) => ({ value: s, label: s }))

  const handleExport = useCallback(async () => {
    if (!entityType) {
      toast.error('Please select an entity type')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const token = getAccessToken()

      const params = new URLSearchParams({ entityType })
      if (status) params.set('status', status)

      const url = `/api/v1/crm/export?${params.toString()}`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (response.status === 401) {
        window.location.href = '/login'
        return
      }

      if (response.status === 403) {
        toast.error('You do not have permission to perform this action')
        return
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: 'Export failed' }))
        throw new Error(data.message || data.error || `Export failed with status ${response.status}`)
      }

      // The API returns CSV directly
      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition')
      let filename = `${entityType}-export.csv`
      if (disposition) {
        const match = disposition.match(/filename=["']?([^"';]+)/)
        if (match?.[1]) filename = match[1]
      }

      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(downloadUrl)

      toast.success(`Export started for ${entityType}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [entityType, status])

  const handleReset = useCallback(() => {
    setEntityType('')
    setStatus('')
    setError(null)
  }, [])

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Export Data</h1>
        <p className='text-muted-foreground mt-1'>
          Export your CRM data as CSV files
        </p>
      </div>

      {/* Export Card */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Download className='size-5' />
            Configure Export
          </CardTitle>
          <CardDescription>
            Choose the entity type and optionally filter by status before exporting.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Entity Type */}
          <div className='space-y-2'>
            <label htmlFor='export-entity' className='text-sm font-medium'>
              Entity Type
            </label>
            <Select
              value={entityType}
              onValueChange={(v) => { setEntityType(v); setStatus(''); setError(null) }}
            >
              <SelectTrigger id='export-entity' className='w-full sm:w-[280px]'>
                <SelectValue placeholder='Select entity type' />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter (Leads/Deals only) */}
          {showStatusFilter && (
            <div className='space-y-2'>
              <label htmlFor='export-status' className='text-sm font-medium'>
                Status Filter
                <span className='ml-1 text-xs font-normal text-muted-foreground'>(optional)</span>
              </label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v === '_all' ? '' : v)}
              >
                <SelectTrigger id='export-status' className='w-full sm:w-[280px]'>
                  <SelectValue placeholder='All Statuses' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='_all'>All Statuses</SelectItem>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Actions */}
          <div className='flex flex-wrap gap-3'>
            <Button
              onClick={handleExport}
              disabled={loading || !entityType}
              className='min-w-[140px]'
            >
              {loading ? (
                <>
                  <Loader2 className='size-4 animate-spin' />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className='size-4' />
                  Export CSV
                </>
              )}
            </Button>
            {error && (
              <Button variant='outline' onClick={handleReset}>
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-start gap-3 py-4'>
            <AlertCircle className='mt-0.5 size-5 shrink-0 text-destructive' />
            <div>
              <p className='text-sm font-medium text-destructive'>Export Error</p>
              <p className='mt-1 text-sm text-muted-foreground'>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
