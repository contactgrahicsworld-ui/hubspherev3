'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Shield, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'

interface Permission {
  id: string
  code: string
  name: string
  description: string | null
}

interface Role {
  id: string
  name: string
  code: string
  permissions: Permission[]
  createdAt: string
}

function RolesSkeleton() {
  return (
    <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className='h-5 w-32' />
            <Skeleton className='h-4 w-20' />
          </CardHeader>
          <CardContent>
            <Skeleton className='h-4 w-24' />
            <div className='mt-3 space-y-2'>
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className='h-3 w-full' />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function RoleCard({ role }: { role: Role }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card>
      <CardHeader>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <CardTitle className='text-base'>{role.name}</CardTitle>
            <CardDescription className='font-mono text-xs'>{role.code}</CardDescription>
          </div>
          <Badge variant='secondary'>{role.permissions.length} perm{role.permissions.length !== 1 ? 's' : ''}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {role.permissions.length > 0 && (
          <>
            <Button
              variant='ghost'
              size='sm'
              className='h-7 text-xs text-muted-foreground px-0'
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronDown className='size-3 mr-1' />
              ) : (
                <ChevronRight className='size-3 mr-1' />
              )}
              {expanded ? 'Hide' : 'Show'} permissions
            </Button>
            {expanded && (
              <div className='mt-2 max-h-48 overflow-y-auto rounded-md border p-2 space-y-1'>
                {role.permissions.map((perm) => (
                  <div key={perm.id} className='flex items-center justify-between text-xs'>
                    <span className='font-mono text-foreground'>{perm.code}</span>
                    <span className='text-muted-foreground truncate ml-2 text-right max-w-[60%]'>
                      {perm.description || perm.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {role.permissions.length === 0 && (
          <p className='text-xs text-muted-foreground'>No permissions assigned</p>
        )}
      </CardContent>
    </Card>
  )
}

export default function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

  useEffect(() => {
    let cancelled = false

    async function fetchRoles() {
      try {
        setLoading(true)
        setError(null)
        const res = await apiFetch<{ success: boolean; data: { roles: Array<{ id: string; code: string; name: string; description: string; isSystem: boolean; permissions: string[]; createdAt: string }>; permissions: Array<{ id: string; code: string; name: string; module: string; action: string }> } }>('/api/v1/super-admin/roles')
        const permMap = new Map(res.data.permissions.map(p => [p.code, { id: p.id, code: p.code, name: p.name, description: null }]))
        const data: Role[] = res.data.roles.map(r => ({
          id: r.id,
          name: r.name,
          code: r.code,
          createdAt: r.createdAt,
          permissions: r.permissions.map(code => permMap.get(code) ?? { id: code, code, name: code, description: null }),
        }))
        if (!cancelled) {
          setRoles(data)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load roles'
          setError(message)
          toast.error(message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchRoles()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Roles</h1>
          <p className='text-muted-foreground mt-1'>Manage roles and permissions</p>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size='sm'
            onClick={() => setViewMode('cards')}
          >
            Cards
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size='sm'
            onClick={() => setViewMode('table')}
          >
            Table
          </Button>
        </div>
      </div>

      {loading && <RolesSkeleton />}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 text-destructive shrink-0' />
            <p className='text-sm text-destructive'>{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && roles.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Shield className='size-10 text-muted-foreground/50 mb-3' />
            <p className='text-sm font-medium text-muted-foreground'>No roles found</p>
            <p className='text-xs text-muted-foreground mt-1'>
              Roles will appear here once they are created.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && roles.length > 0 && viewMode === 'cards' && (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {roles.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}
        </div>
      )}

      {!loading && !error && roles.length > 0 && viewMode === 'table' && (
        <Card>
          <CardContent className='p-0'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className='text-right'>Permissions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className='font-medium'>{role.name}</TableCell>
                    <TableCell className='text-muted-foreground font-mono text-xs'>
                      {role.code}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Badge variant='secondary'>{role.permissions.length}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
