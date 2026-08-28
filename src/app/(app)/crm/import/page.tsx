'use client'

import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { getAccessToken } from '@/lib/auth-client'

// ============================================
// Types
// ============================================

interface ImportError {
  row: number
  message: string
}

interface ImportResult {
  created: number
  skipped: number
  errors: ImportError[]
}

// ============================================
// Templates
// ============================================

const TEMPLATES: Record<string, string> = {
  leads: 'First Name,Last Name,Email,Mobile,Company,Source,Priority\nJohn,Doe,john@example.com,555-0101,Acme Inc,WEBSITE,HIGH\nJane,Smith,jane@example.com,555-0102,Globex Corp,REFERRAL,MEDIUM',
  contacts: 'First Name,Last Name,Email,Mobile,Phone,Title\nJohn,Doe,john@example.com,555-0101,555-0103,CEO\nJane,Smith,jane@example.com,555-0102,555-0104,CTO',
  companies: 'Name,Industry,Website,Email,Phone,Address,City,State,Country\nAcme Inc,Technology,https://acme.com,info@acme.com,555-0101,123 Main St,New York,NY,US\nGlobex Corp,Finance,https://globex.com,info@globex.com,555-0102,456 Oak Ave,Los Angeles,CA,US',
}

// ============================================
// Helpers
// ============================================

function downloadTemplate(entityType: string) {
  const csv = TEMPLATES[entityType]
  if (!csv) return
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${entityType}-template.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ============================================
// Main Page
// ============================================

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [entityType, setEntityType] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    if (selected && !selected.name.endsWith('.csv')) {
      toast.error('Please select a .csv file')
      return
    }
    setFile(selected)
    setResult(null)
    setError(null)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!entityType) {
      toast.error('Please select an entity type')
      return
    }
    if (!file) {
      toast.error('Please select a CSV file')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setResult(null)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('entityType', entityType)

      const token = getAccessToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch('/api/v1/crm/import', {
        method: 'POST',
        headers,
        body: formData,
      })

      if (response.status === 401) {
        window.location.href = '/login'
        return
      }

      if (response.status === 403) {
        toast.error('You do not have permission to perform this action')
        return
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || `Import failed with status ${response.status}`)
      }

      const importData = data.data as ImportResult
      setResult(importData)

      if (importData.errors.length === 0) {
        toast.success(`Successfully imported ${importData.created} records`)  
      } else {
        toast.warning(`Imported ${importData.created} records with ${importData.errors.length} errors`)
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setFile(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [entityType, file])

  const handleReset = useCallback(() => {
    setEntityType('')
    setFile(null)
    setResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Import Data</h1>
        <p className='text-muted-foreground mt-1'>
          Import leads, contacts, or companies from a CSV file
        </p>
      </div>

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Upload className='size-5' />
            Upload CSV File
          </CardTitle>
          <CardDescription>
            Select the entity type and upload your CSV file. Make sure your file matches the expected format.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Entity Type Select */}
          <div className='space-y-2'>
            <label htmlFor='entity-type' className='text-sm font-medium'>
              Entity Type
            </label>
            <Select value={entityType} onValueChange={(v) => { setEntityType(v); setResult(null); setError(null) }}>
              <SelectTrigger id='entity-type' className='w-full sm:w-[280px]'>
                <SelectValue placeholder='Select entity type' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='leads'>Leads</SelectItem>
                <SelectItem value='contacts'>Contacts</SelectItem>
                <SelectItem value='companies'>Companies</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* File Upload */}
          <div className='space-y-2'>
            <label htmlFor='csv-file' className='text-sm font-medium'>
              CSV File
            </label>
            <div
              className={[
                'flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
                file
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50',
              ].join(' ')}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
              role='button'
              tabIndex={0}
              aria-label='Click to select CSV file'
            >
              <input
                ref={fileInputRef}
                type='file'
                accept='.csv'
                onChange={handleFileChange}
                className='hidden'
                aria-hidden='true'
              />
              {file ? (
                <>
                  <FileSpreadsheet className='mb-2 size-8 text-primary' />
                  <p className='text-sm font-medium'>{file.name}</p>
                  <p className='text-xs text-muted-foreground'>
                    {(file.size / 1024).toFixed(1)} KB — Click to change
                  </p>
                </>
              ) : (
                <>
                  <Upload className='mb-2 size-8 text-muted-foreground/50' />
                  <p className='text-sm text-muted-foreground'>
                    Click to upload or drag and drop
                  </p>
                  <p className='text-xs text-muted-foreground'>CSV files only</p>
                </>
              )}
            </div>
          </div>

          {/* Download Template */}
          {entityType && (
            <div className='flex items-center gap-2 rounded-lg border bg-muted/30 p-3'>
              <Download className='size-4 shrink-0 text-muted-foreground' />
              <p className='flex-1 text-sm text-muted-foreground'>
                Not sure about the format?{' '}
                <button
                  type='button'
                  className='font-medium text-primary underline underline-offset-2 hover:text-primary/80'
                  onClick={(e) => { e.stopPropagation(); downloadTemplate(entityType) }}
                >
                  Download {entityType} template
                </button>
              </p>
            </div>
          )}

          {/* Actions */}
          <div className='flex flex-wrap gap-3'>
            <Button
              onClick={handleSubmit}
              disabled={loading || !entityType || !file}
              className='min-w-[140px]'
            >
              {loading ? (
                <>
                  <Loader2 className='size-4 animate-spin' />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className='size-4' />
                  Import Data
                </>
              )}
            </Button>
            {(result || error) && (
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
              <p className='text-sm font-medium text-destructive'>Import Error</p>
              <p className='mt-1 text-sm text-muted-foreground'>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result State */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <CheckCircle2 className='size-5 text-green-600' />
              Import Results
            </CardTitle>
            <CardDescription>
              Import completed for {entityType}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Summary */}
            <div className='grid grid-cols-2 gap-4 sm:grid-cols-3'>
              <div className='rounded-lg border bg-muted/30 p-4 text-center'>
                <p className='text-2xl font-bold text-green-600'>{result.created}</p>
                <p className='text-xs text-muted-foreground'>Created</p>
              </div>
              <div className='rounded-lg border bg-muted/30 p-4 text-center'>
                <p className='text-2xl font-bold text-amber-600'>{result.skipped}</p>
                <p className='text-xs text-muted-foreground'>Skipped (duplicates)</p>
              </div>
              <div className='col-span-2 rounded-lg border bg-muted/30 p-4 text-center sm:col-span-1'>
                <p className='text-2xl font-bold text-red-600'>{result.errors.length}</p>
                <p className='text-xs text-muted-foreground'>Errors</p>
              </div>
            </div>

            {/* Error List */}
            {result.errors.length > 0 && (
              <div className='space-y-2'>
                <h3 className='text-sm font-medium'>Row Errors</h3>
                <div className='max-h-60 overflow-y-auto rounded-lg border'>
                  <ul className='divide-y'>
                    {result.errors.map((err, i) => (
                      <li key={i} className='flex items-start gap-3 px-4 py-2.5 text-sm'>
                        <Badge variant='outline' className='shrink-0 font-mono text-xs'>
                          Row {err.row}
                        </Badge>
                        <span className='text-muted-foreground'>{err.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
