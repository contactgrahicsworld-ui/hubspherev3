'use client'

import { useEffect, useState, useCallback, type FormEvent } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Shield, AlertCircle, Plus, Loader2, Users } from 'lucide-react'

interface Role {
  id: string
  code: string
  name: string
  description: string
  memberCount: number
}

function RolesSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <Skeleton className='h-8 w-48' />
          <Skeleton className='mt-2 h-4 w-72' />
        </div>
        <Skeleton className='h-9 w-32' />
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className='h-5 w-28' />
              <Skeleton className='h-3 w-16' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-4 w-48' />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch<{ success: boolean; data: Array<{ id: string; code: string; name: string; description: string | null; isSystem: boolean; isTenantScoped: boolean; permissions: string[]; createdAt: string }> }>('/api/v1/admin/roles')
      const data: Role[] = res.data.map(r => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description ?? '',
        memberCount: 0,
      }))
      setRoles(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load roles'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!newCode.trim() || !newName.trim()) return

    try {
      setCreating(true)
      await apiFetch('/api/v1/admin/roles', {
        method: 'POST',
        body: JSON.stringify({
          code: newCode.trim(),
          name: newName.trim(),
          description: newDescription.trim(),
        }),
      })
      toast.success(`Role "${newName.trim()}" created successfully`)
      setDialogOpen(false)
      setNewCode('')
      setNewName('')
      setNewDescription('')
      fetchRoles()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create role'
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Role Management</h1>
          <p className='text-muted-foreground mt-1'>
            Create and manage roles for your organization
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className='min-w-[120px]'>
              <Plus className='size-4' />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
              <DialogDescription>
                Define a new role with a unique code and description.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='role-code'>Role Code</Label>
                <Input
                  id='role-code'
                  placeholder='e.g., EDITOR'
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  required
                  aria-required='true'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='role-name'>Role Name</Label>
                <Input
                  id='role-name'
                  placeholder='e.g., Editor'
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  aria-required='true'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='role-desc'>Description</Label>
                <Input
                  id='role-desc'
                  placeholder='Brief description of this role'
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setDialogOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button type='submit' disabled={creating || !newCode.trim() || !newName.trim()}>
                  {creating ? (
                    <>
                      <Loader2 className='size-4 animate-spin' />
                      Creating...
                    </>
                  ) : (
                    'Create Role'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
              Create your first custom role to get started.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && roles.length > 0 && (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <div className='flex items-start justify-between gap-2'>
                  <CardTitle className='text-base'>{role.name}</CardTitle>
                  <Badge variant='outline'>{role.code}</Badge>
                </div>
                <CardDescription>{role.description || 'No description'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                  <Users className='size-4' />
                  <span>
                    {role.memberCount} {role.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
