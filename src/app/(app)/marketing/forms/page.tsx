'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination'
import { FileText, AlertCircle } from 'lucide-react'

interface LeadCaptureForm {
  id: string; name: string; fields: any; settings: any
  isActive: boolean; submissionCount: number; createdAt: string
}

interface PaginatedResponse {
  success: boolean; data: LeadCaptureForm[]; pagination: { page: number; limit: number; total: number; totalPages: number }
}

export default function LeadCaptureFormsPage() {
  const [forms, setForms] = useState<LeadCaptureForm[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchForms = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      const data = await apiFetch<PaginatedResponse>(`/api/v1/marketing/lead-capture-forms?${params}`)
      setForms(data.data); setTotalPages(data.pagination.totalPages); setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load forms'
      setError(message); toast.error(message)
    } finally { setLoading(false) }
  }, [page])

  useEffect(() => { fetchForms() }, [fetchForms])

  const renderPageNumbers = () => {
    const pages: number[] = []; const maxVisible = 5
    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Lead Capture Forms</h1>
        <p className='text-muted-foreground mt-1'>Create and manage forms to capture leads from your website</p>
      </div>

      {loading && <div className='space-y-3'>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className='h-12' />)}</div>}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 shrink-0 text-destructive' />
            <p className='text-sm text-destructive'>{error}</p>
            <Button variant='outline' size='sm' className='ml-auto shrink-0' onClick={fetchForms}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && forms.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <FileText className='mb-3 size-10 text-muted-foreground/50' />
            <p className='text-sm font-medium text-muted-foreground'>No lead capture forms yet</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && forms.length > 0 && (
        <>
          <div className='space-y-4'>
            {forms.map((form) => {
              const fields = Array.isArray(form.fields) ? form.fields : []
              return (
                <Card key={form.id}>
                  <CardContent className='p-4'>
                    <div className='flex items-start justify-between'>
                      <div>
                        <div className='flex items-center gap-2'>
                          <p className='font-medium'>{form.name}</p>
                          <Badge variant='outline' className={form.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-700'}>
                            {form.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className='mt-1 text-sm text-muted-foreground'>
                          {fields.length} field{fields.length !== 1 ? 's' : ''} · {form.submissionCount} submission{form.submissionCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className='text-right'>
                        <p className='text-2xl font-bold'>{form.submissionCount}</p>
                        <p className='text-xs text-muted-foreground'>submissions</p>
                      </div>
                    </div>
                    {fields.length > 0 && (
                      <div className='mt-3 flex flex-wrap gap-1.5'>
                        {fields.map((f: any, idx: number) => (
                          <Badge key={idx} variant='outline' className='text-xs'>{f.label || f.name || f.type || `Field ${idx + 1}`}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>Showing {forms.length} of {total} forms</p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem><PaginationPrevious href='#' onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1) }} className={page <= 1 ? 'pointer-events-none opacity-50' : ''} /></PaginationItem>
                  {renderPageNumbers().map((p) => (<PaginationItem key={p}><PaginationLink href='#' isActive={p === page} onClick={(e) => { e.preventDefault(); setPage(p) }}>{p}</PaginationLink></PaginationItem>))}
                  <PaginationItem><PaginationNext href='#' onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1) }} className={page >= totalPages ? 'pointer-events-none opacity-50' : ''} /></PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  )
}
