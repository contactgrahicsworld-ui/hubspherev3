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
import { CompanyFormDialog } from '@/components/crm/company-form'
import {
  Plus,
  Search,
  Filter,
  AlertCircle,
  Building2,
  RotateCcw,
  Mail,
  Phone,
  MapPin,
  Users,
  DollarSign,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface CompanyOwner {
  id: string
  name: string | null
  email: string | null
}

interface Company {
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
  owner: CompanyOwner | null
  archived: boolean
  contactCount: number
  dealCount: number
  createdAt: string
  updatedAt: string
}

interface UserOption {
  id: string
  name: string
  email: string
}

interface PaginatedResponse {
  success: boolean
  data: Company[]
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
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
  { value: 'industry-asc', label: 'Industry A-Z' },
]

// ============================================
// Helpers
// ============================================

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  } catch { return '-' }
}

// ============================================
// Table Skeleton
// ============================================

function TableSkeleton() {
  return (
    <Card>
      <CardContent className='p-0'>
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 9 }).map((_, i) => (
                <TableHead key={i}><Skeleton className='h-4 w-20' /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 9 }).map((_, j) => (
                  <TableCell key={j}><Skeleton className='h-4 w-full' /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ============================================
// Mobile Card
// ============================================

function MobileCompanyCard({ company, onClick }: { company: Company; onClick: () => void }) {
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
            <p className='truncate font-medium'>{company.name}</p>
            {company.industry && (
              <p className='mt-0.5 truncate text-xs text-muted-foreground'>{company.industry}</p>
            )}
          </div>
          <div className='flex shrink-0 gap-2 text-xs text-muted-foreground'>
            <span className='flex items-center gap-1'>
              <Users className='size-3' />{company.contactCount}
            </span>
            <span className='flex items-center gap-1'>
              <DollarSign className='size-3' />{company.dealCount}
            </span>
          </div>
        </div>

        <div className='mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
          {company.email && (
            <span className='flex items-center gap-1 truncate'>
              <Mail className='size-3 shrink-0' />{company.email}
            </span>
          )}
          {company.phone && (
            <span className='flex items-center gap-1 truncate'>
              <Phone className='size-3 shrink-0' />{company.phone}
            </span>
          )}
        </div>

        {(company.city || company.owner?.name) && (
          <div className='mt-2 flex items-center justify-between text-xs text-muted-foreground'>
            <span>{company.city || '-'}</span>
            <span>{company.owner?.name || 'Unassigned'}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page
// ============================================

export default function CompaniesListPage() {
  const router = useRouter()

  const [companies, setCompanies] = useState<Company[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [industry, setIndustry] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [city, setCity] = useState('')
  const [sort, setSort] = useState('createdAt-desc')

  const [formOpen, setFormOpen] = useState(false)

  // Filter options
  const [users, setUsers] = useState<UserOption[]>([])
  const [industries, setIndustries] = useState<string[]>([])
  const [cities, setCities] = useState<string[]>([])

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
        const [usersRes, companiesRes] = await Promise.all([
          apiFetch<{ success: boolean; data: UserOption[] }>('/api/v1/admin/users?limit=100'),
          apiFetch<{ success: boolean; data: Company[]; pagination: { total: number } }>(
            '/api/v1/crm/companies?limit=100'
          ),
        ])
        setUsers(usersRes.data ?? [])
        const allCompanies = companiesRes.data ?? []
        const indSet = new Set<string>()
        const citySet = new Set<string>()
        for (const c of allCompanies) {
          if (c.industry) indSet.add(c.industry)
          if (c.city) citySet.add(c.city)
        }
        setIndustries([...indSet].sort())
        setCities([...citySet].sort())
      } catch { /* silent */ }
    }
    fetchOptions()
  }, [])

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [sortBy, sortOrder] = sort.split('-')
      const params = new URLSearchParams({
        page: String(page), limit: '20', sortBy, sortOrder,
      })

      if (debouncedSearch) params.set('search', debouncedSearch)
      if (industry) params.set('industry', industry)
      if (ownerId) params.set('ownerId', ownerId)
      if (city) params.set('city', city)

      const data = await apiFetch<PaginatedResponse>(`/api/v1/crm/companies?${params}`)
      setCompanies(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load companies'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, industry, ownerId, city, sort])

  useEffect(() => { fetchCompanies() }, [fetchCompanies])
  useEffect(() => { setPage(1) }, [debouncedSearch, industry, ownerId, city, sort])

  const renderPageNumbers = () => {
    const pages: number[] = []
    const maxVisible = 5
    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  const hasActiveFilters = search || industry || ownerId || city
  const clearFilters = () => {
    setSearch('')
    setIndustry('')
    setOwnerId('')
    setCity('')
    setSort('createdAt-desc')
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Companies</h1>
          <p className='text-muted-foreground mt-1'>Manage your companies and organizations</p>
        </div>
        <Button className='min-w-[160px]' onClick={() => setFormOpen(true)}>
          <Plus className='size-4' /> Create Company
        </Button>
      </div>

      {/* Search and Filters */}
      <div className='flex flex-col gap-3'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Search by name, email, phone, website, or industry...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-9'
            aria-label='Search companies'
          />
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <div className='flex items-center gap-1.5 text-sm text-muted-foreground'>
            <Filter className='size-4' />
            <span className='hidden sm:inline'>Filters:</span>
          </div>

          <Select value={industry} onValueChange={(v) => setIndustry(v === '_all' ? '' : v)}>
            <SelectTrigger className='w-[140px]' aria-label='Filter by industry'>
              <SelectValue placeholder='All Industries' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='_all'>All Industries</SelectItem>
              {industries.map((ind) => (
                <SelectItem key={ind} value={ind}>{ind}</SelectItem>
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

          <Select value={city} onValueChange={(v) => setCity(v === '_all' ? '' : v)}>
            <SelectTrigger className='w-[140px]' aria-label='Filter by city'>
              <SelectValue placeholder='All Cities' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='_all'>All Cities</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className='w-[160px]' aria-label='Sort by'>
              <SelectValue placeholder='Sort by' />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant='ghost' size='sm' onClick={clearFilters}>
              <RotateCcw className='size-3' /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && <TableSkeleton />}

      {/* Error */}
      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 shrink-0 text-destructive' />
            <p className='text-sm text-destructive'>{error}</p>
            <Button variant='outline' size='sm' className='ml-auto shrink-0' onClick={fetchCompanies}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!loading && !error && companies.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Building2 className='mb-3 size-10 text-muted-foreground/50' />
            <p className='text-sm font-medium text-muted-foreground'>No companies yet</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              {hasActiveFilters ? 'Try adjusting your filters.' : 'Create your first company to get started.'}
            </p>
            {!hasActiveFilters && (
              <Button className='mt-4' size='sm' onClick={() => setFormOpen(true)}>
                <Plus className='size-4' /> Create Company
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Desktop Table */}
      {!loading && !error && companies.length > 0 && (
        <>
          <Card className='hidden md:block'>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='min-w-[160px]'>Name</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className='text-center'>Contacts</TableHead>
                    <TableHead className='text-center'>Deals</TableHead>
                    <TableHead>Owner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((c) => (
                    <TableRow
                      key={c.id}
                      className='cursor-pointer'
                      onClick={() => router.push(`/crm/companies/${c.id}`)}
                    >
                      <TableCell className='font-medium'>{c.name}</TableCell>
                      <TableCell className='text-muted-foreground'>{c.industry || '-'}</TableCell>
                      <TableCell className='max-w-[180px] truncate text-muted-foreground'>{c.email || '-'}</TableCell>
                      <TableCell className='text-muted-foreground'>{c.phone || '-'}</TableCell>
                      <TableCell className='text-muted-foreground'>{c.city || '-'}</TableCell>
                      <TableCell className='text-muted-foreground'>{c.state || '-'}</TableCell>
                      <TableCell className='text-center font-medium'>{c.contactCount}</TableCell>
                      <TableCell className='text-center font-medium'>{c.dealCount}</TableCell>
                      <TableCell className='text-muted-foreground'>{c.owner?.name || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Cards */}
          <div className='flex flex-col gap-3 md:hidden'>
            {companies.map((c) => (
              <MobileCompanyCard
                key={c.id}
                company={c}
                onClick={() => router.push(`/crm/companies/${c.id}`)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-2'>
              <p className='text-xs text-muted-foreground'>
                Showing {companies.length} of {total} companies
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href='#'
                      onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1) }}
                      aria-disabled={page <= 1}
                      className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                  {renderPageNumbers().map((p) => (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href='#'
                        isActive={p === page}
                        onClick={(e) => { e.preventDefault(); setPage(p) }}
                      >{p}</PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href='#'
                      onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1) }}
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

      <CompanyFormDialog open={formOpen} onOpenChange={setFormOpen} onSuccess={fetchCompanies} />
    </div>
  )
}
