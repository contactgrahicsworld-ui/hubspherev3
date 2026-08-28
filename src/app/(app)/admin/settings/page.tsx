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
import { AlertCircle, Loader2, Save } from 'lucide-react'

interface OrgSettings {
  name: string
  domain: string
}

function SettingsSkeleton() {
  return (
    <div className='space-y-6'>
      <div>
        <Skeleton className='h-8 w-56' />
        <Skeleton className='mt-2 h-4 w-80' />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className='h-5 w-40' />
          <Skeleton className='h-3 w-56' />
        </CardHeader>
        <CardContent className='space-y-4'>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className='space-y-2'>
              <Skeleton className='h-4 w-28' />
              <Skeleton className='h-9 w-full' />
            </div>
          ))}
          <Skeleton className='h-9 w-24' />
        </CardContent>
      </Card>
    </div>
  )
}

export default function OrgSettingsPage() {
  const [settings, setSettings] = useState<OrgSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiFetch<OrgSettings>('/api/v1/admin/settings')
      setSettings(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load settings'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!settings) return

    try {
      setSaving(true)
      await apiFetch('/api/v1/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      })
      toast.success('Settings saved successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save settings'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Organization Settings</h1>
        <p className='text-muted-foreground mt-1'>
          Manage your organization name and domain
        </p>
      </div>

      {loading && <SettingsSkeleton />}

      {error && !loading && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 text-destructive shrink-0' />
            <p className='text-sm text-destructive'>{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && settings && (
        <Card>
          <CardHeader>
            <CardTitle>General Information</CardTitle>
            <CardDescription>
              Update your organization&apos;s display name and domain
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='org-name'>Organization Name</Label>
                <Input
                  id='org-name'
                  value={settings.name}
                  onChange={(e) =>
                    setSettings((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                  }
                  placeholder='Enter organization name'
                  required
                  aria-required='true'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='org-domain'>Domain</Label>
                <Input
                  id='org-domain'
                  value={settings.domain}
                  onChange={(e) =>
                    setSettings((prev) => (prev ? { ...prev, domain: e.target.value } : prev))
                  }
                  placeholder='e.g., company.com'
                  aria-required='false'
                />
              </div>

              <Button type='submit' disabled={saving} className='min-w-[100px]'>
                {saving ? (
                  <>
                    <Loader2 className='size-4 animate-spin' />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className='size-4' />
                    Save Changes
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {!loading && !error && !settings && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <AlertCircle className='size-10 text-muted-foreground/50 mb-3' />
            <p className='text-sm font-medium text-muted-foreground'>No settings available</p>
            <p className='text-xs text-muted-foreground mt-1'>
              Unable to load organization settings.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
