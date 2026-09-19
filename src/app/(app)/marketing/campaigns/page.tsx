'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination'
import { Megaphone, AlertCircle, RotateCcw } from 'lucide-react'

interface Campaign {
  id: string; name: string; type: string; status: string; startDate: string | null; endDate: string | null; createdAt: string
  creator: { id: string; name: string | null } | null
}

interface PaginatedResponse {
  success: boolean; data: Campaign[]; pagination: { page: number; limit: number; total: number; totalPages: number }
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RUNNING: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PAUSED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  COMPLETED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
}

const TYPE_BADGE: Record<string, string> = {
  EMAIL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  SMS: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  WHATSAPP: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  MULTI_CHANNEL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '-' }
}

export default function CampaignsListPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (status) params.set('status', status)
      if (type) params.set('type', type)
      const data = await apiFetch<PaginatedResponse>(`/api/v1/marketing/campaigns?${params}`)
      setCampaigns(data.data); setTotalPages(data.pagination.totalPages); setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load campaigns'
      setError(message); toast.error(message)
    } finally { setLoading(false) }
  }, [page, status, type])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

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
        <h1 className='text-2xl font-bold tracking-tight'>Campaigns</h1>
        <p className='text-muted-foreground mt-1'>Manage email, SMS, WhatsApp, and multi-channel campaigns</p>
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <Select value={status} onValueChange={(v) => { setStatus(v === '_all' ? '' : v); setPage(1) }}>
          <SelectTrigger className='w-[140px]'><SelectValue placeholder='All Statuses' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='_all'>All Statuses</SelectItem>
            <SelectItem value='DRAFT'>Draft</SelectItem>
            <SelectItem value='SCHEDULED'>Scheduled</SelectItem>
            <SelectItem value='RUNNING'>Running</SelectItem>
            <SelectItem value='PAUSED'>Paused</SelectItem>
            <SelectItem value='COMPLETED'>Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => { setType(v === '_all' ? '' : v); setPage(1) }}>
          <SelectTrigger className='w-[140px]'><SelectValue placeholder='All Types' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='_all'>All Types</SelectItem>
            <SelectItem value='EMAIL'>Email</SelectItem>
            <SelectItem value='SMS'>SMS</SelectItem>
            <SelectItem value='WHATSAPP'>WhatsApp</SelectItem>
            <SelectItem value='MULTI_CHANNEL'>Multi-Channel</SelectItem>
          </SelectContent>
        </Select>
        {(status || type) && <Button variant='ghost' size='sm' onClick={() => { setStatus(''); setType('') }}><RotateCcw className='size-3' /> Clear</Button>}
      </div>

      {loading && <div className='space-y-3'>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className='h-12' />)}</div>}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 shrink-0 text-destructive' />
            <p className='text-sm text-destructive'>{error}</p>
            <Button variant='outline' size='sm' className='ml-auto shrink-0' onClick={fetchCampaigns}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && campaigns.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Megaphone className='mb-3 size-10 text-muted-foreground/50' />
            <p className='text-sm font-medium text-muted-foreground'>No campaigns yet</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && campaigns.length > 0 && (
        <>
          <Card className='hidden md:block'>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Created By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c) => (
                    <TableRow key={c.id} className='cursor-pointer' onClick={() => router.push(`/marketing/campaigns/${c.id}`)}>
                      <TableCell className='font-medium'>{c.name}</TableCell>
                      <TableCell><Badge variant='outline' className={TYPE_BADGE[c.type] || ''}>{c.type}</Badge></TableCell>
                      <TableCell><Badge variant='outline' className={STATUS_BADGE[c.status] || ''}>{c.status}</Badge></TableCell>
                      <TableCell className='text-muted-foreground'>{formatDate(c.startDate)}</TableCell>
                      <TableCell className='text-muted-foreground'>{formatDate(c.endDate)}</TableCell>
                      <TableCell className='text-muted-foreground'>{c.creator?.name || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className='flex flex-col gap-3 md:hidden'>
            {campaigns.map((c) => (
              <Card key={c.id} className='cursor-pointer' onClick={() => router.push(`/marketing/campaigns/${c.id}`)}>
                <CardContent className='p-4'>
                  <div className='flex items-start justify-between'>
                    <div>
                      <p className='font-medium'>{c.name}</p>
                      <p className='text-xs text-muted-foreground'>{formatDate(c.startDate)}</p>
                    </div>
                    <Badge variant='outline' className={STATUS_BADGE[c.status] || ''}>{c.status}</Badge>
                  </div>
                  <div className='mt-2'><Badge variant='outline' className={TYPE_BADGE[c.type] || ''}>{c.type}</Badge></div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>Showing {campaigns.length} of {total} campaigns</p>
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
