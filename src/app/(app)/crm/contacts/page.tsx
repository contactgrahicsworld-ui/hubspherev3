'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ContactFormDialog } from '@/components/crm/contact-form'
import {
  Plus,
  Search,
  Filter,
  AlertCircle,
  Users,
  Mail,
  Phone,
  Building2,
  RotateCcw,
} from 'lucide-react'
import { TableSkeleton } from '@/components/skeletons'

// ============================================
// Types
// ============================================

interface ContactOwner {
  id: string
  name: string | null
  email: string | null
}

interface ContactCompany {
  id: string
  name: string
  industry: string | null
}

interface Contact {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
  mobile: string | null
  phone: string | null
  title: string | null
  companyId: string | null
  company: ContactCompany | null
  ownerId: string | null
  owner: ContactOwner | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

interface CompanyOption {
  id: string
  name: string
}

interface UserOption {
  id: string
  name: string
  email: string
}

interface PaginatedResponse {
  success: boolean
  data: Contact[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ============================================
// Constants
// ============================================

const SORT_OPTIONS = [
  { value: 'createdAt-desc', label: 'Newest First' },
  { value: 'createdAt-asc', label: 'Oldest First' },
  { value: 'updatedAt-desc', label: 'Recently Updated' },
  { value: 'firstName-asc', label: 'Name A-Z' },
  { value: 'firstName-desc', label: 'Name Z-A' },
  { value: 'email-asc', label: 'Email A-Z' },
]

// ============================================
// Helpers
// ============================================

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return '-'
  }
}

function getContactName(c: Contact): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || '-'
}


// ============================================
// Mobile Card
// ============================================

function MobileContactCard({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  return (
    <Card
      className='cursor-pointer transition-shadow hover:shadow-md'
      onClick={onClick}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
    >
      <CardContent className='p-4'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0 flex-1'>
            <p className='truncate font-medium'>{getContactName(contact)}</p>
            {contact.title && (
              <p className='mt-0.5 truncate text-xs text-muted-foreground'>{contact.title}</p>
            )}
          </div>
          {contact.company && (
            <span className='shrink-0 text-xs text-muted-foreground'>{contact.company.name}</span>
          )}
        </div>

        <div className='mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
          {contact.email && (
            <span className='flex items-center gap-1 truncate'>
              <Mail className='size-3 shrink-0' />{contact.email}
            </span>
          )}
          {contact.mobile && (
            <span className='flex items-center gap-1 truncate'>
              <Phone className='size-3 shrink-0' />{contact.mobile}
            </span>
          )}
        </div>

        <div className='mt-2 flex items-center justify-between text-xs text-muted-foreground'>
          <span>{contact.owner?.name || 'Unassigned'}</span>
          <span>{formatDate(contact.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page
// ============================================

export default function ContactsListPage() {
  const router = useRouter()

  const [contacts, setContacts] = useState<Contact[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [sort, setSort] = useState('createdAt-desc')

  const [formOpen, setFormOpen] = useState(false)

  // Filter options
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [users, setUsers] = useState<UserOption[]>([])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  // Fetch filter options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [companiesRes, usersRes] = await Promise.all([
          apiFetch<{ success: boolean; data: CompanyOption[] }>('/api/v1/crm/companies?limit=100'),
          apiFetch<{ success: boolean; data: UserOption[] }>('/api/v1/admin/users?limit=100'),
        ])
        setCompanies(companiesRes.data ?? [])
        setUsers(usersRes.data ?? [])
      } catch {
        // silent
      }
    }
    fetchOptions()
  }, [])

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [sortBy, sortOrder] = sort.split('-')
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        sortBy,
        sortOrder,
      })

      if (debouncedSearch) params.set('search', debouncedSearch)
      if (companyId) params.set('companyId', companyId)
      if (ownerId) params.set('ownerId', ownerId)

      const data = await apiFetch<PaginatedResponse>(`/api/v1/crm/contacts?${params}`)
      setContacts(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load contacts'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, companyId, ownerId, sort])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, companyId, ownerId, sort])

  const renderPageNumbers = () => {
    const pages: number[] = []
    const maxVisible = 5
    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    return pages
  }

  const hasActiveFilters = search || companyId || ownerId

  const clearFilters = () => {
    setSearch('')
    setCompanyId('')
    setOwnerId('')
    setSort('createdAt-desc')
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Contacts</h1>
          <p className='text-muted-foreground mt-1'>
            Manage your contacts and their information
          </p>
        </div>
        <Button className='min-w-[150px]' onClick={() => setFormOpen(true)}>
          <Plus className='size-4' />
          Create Contact
        </Button>
      </div>

      {/* Search and Filters */}
      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Search by name, email, mobile, phone, or title...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-9'
            aria-label='Search contacts'
          />
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <div className='flex items-center gap-1.5 text-sm text-muted-foreground'>
            <Filter className='size-4' />
            <span className='hidden sm:inline'>Filters:</span>
          </div>

          <Select value={companyId} onValueChange={(v) => setCompanyId(v === '_all' ? '' : v)}>
            <SelectTrigger className='w-[150px]' aria-label='Filter by company'>
              <SelectValue placeholder='All Companies' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='_all'>All Companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={ownerId} onValueChange={(v) => setOwnerId(v === '_all' ? '' : v)}>
            <SelectTrigger className='w-[150px]' aria-label='Filter by owner'>
              <SelectValue placeholder='All Owners' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='_all'>All Owners</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className='w-[160px]' aria-label='Sort by'>
              <SelectValue placeholder='Sort by' />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant='ghost' size='sm' onClick={clearFilters}>
              <RotateCcw className='size-3' />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && <TableSkeleton />}

      {/* Error State */}
      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 shrink-0 text-destructive' />
            <p className='text-sm text-destructive'>{error}</p>
            <Button
              variant='outline'
              size='sm'
              className='ml-auto shrink-0'
              onClick={fetchContacts}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && contacts.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Users className='mb-3 size-10 text-muted-foreground/50' />
            <p className='text-sm font-medium text-muted-foreground'>No contacts yet</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              {hasActiveFilters
                ? 'Try adjusting your filters.'
                : 'Create your first contact to get started.'}
            </p>
            {!hasActiveFilters && (
              <Button className='mt-4' size='sm' onClick={() => setFormOpen(true)}>
                <Plus className='size-4' />
                Create Contact
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Desktop Table */}
      {!loading && !error && contacts.length > 0 && (
        <>
          <Card className='hidden md:block'>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='min-w-[160px]'>Name</TableHead>
                    <TableHead className='min-w-[180px]'>Email</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c) => (
                    <TableRow
                      key={c.id}
                      className='cursor-pointer'
                      onClick={() => router.push(`/crm/contacts/${c.id}`)}
                    >
                      <TableCell className='font-medium'>
                        {getContactName(c)}
                      </TableCell>
                      <TableCell className='max-w-[200px] truncate text-muted-foreground'>
                        {c.email || '-'}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {c.mobile || '-'}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {c.phone || '-'}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {c.title || '-'}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {c.company?.name || '-'}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {c.owner?.name || '-'}
                      </TableCell>
                      <TableCell className='whitespace-nowrap text-xs text-muted-foreground'>
                        {formatDate(c.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Cards */}
          <div className='flex flex-col gap-3 md:hidden'>
            {contacts.map((c) => (
              <MobileContactCard
                key={c.id}
                contact={c}
                onClick={() => router.push(`/crm/contacts/${c.id}`)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>
                Showing {contacts.length} of {total} contacts
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href='#'
                      onClick={(e) => {
                        e.preventDefault()
                        if (page > 1) setPage(page - 1)
                      }}
                      aria-disabled={page <= 1}
                      className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                  {renderPageNumbers().map((p) => (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href='#'
                        isActive={p === page}
                        onClick={(e) => {
                          e.preventDefault()
                          setPage(p)
                        }}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href='#'
                      onClick={(e) => {
                        e.preventDefault()
                        if (page < totalPages) setPage(page + 1)
                      }}
                      aria-disabled={page >= totalPages}
                      className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}

      <ContactFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={fetchContacts}
      />
    </div>
  )
}
