'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { KeyRound, ShieldCheck, Smartphone, Key, Loader2, Plus, Trash2 } from 'lucide-react'

interface PasswordPolicy {
  minLength: number
  requireUppercase: boolean
  requireNumbers: boolean
  requireSpecialChars: boolean
}
interface SessionManagement {
  sessionTimeout: number
  maxConcurrentSessions: number
}
interface TwoFactor {
  enforceForAdmins: boolean
}
interface ApiKeyInfo {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string | null
  prefix: string
}
interface SecuritySettings {
  passwordPolicy: PasswordPolicy
  sessionManagement: SessionManagement
  twoFactor: TwoFactor
  apiKeys: ApiKeyInfo[]
}

export default function AdminSecurityPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Password Policy
  const [minLength, setMinLength] = useState(8)
  const [requireUppercase, setRequireUppercase] = useState(true)
  const [requireNumbers, setRequireNumbers] = useState(true)
  const [requireSpecialChars, setRequireSpecialChars] = useState(false)

  // Session Management
  const [sessionTimeout, setSessionTimeout] = useState(30)
  const [maxConcurrentSessions, setMaxConcurrentSessions] = useState(5)

  // Two-Factor
  const [enforceForAdmins, setEnforceForAdmins] = useState(false)

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([])
  const [createKeyOpen, setCreateKeyOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch<{ success: boolean; data: SecuritySettings }>(
          '/api/v1/admin/security'
        )
        if (res.success && res.data) {
          const d = res.data
          setMinLength(d.passwordPolicy.minLength)
          setRequireUppercase(d.passwordPolicy.requireUppercase)
          setRequireNumbers(d.passwordPolicy.requireNumbers)
          setRequireSpecialChars(d.passwordPolicy.requireSpecialChars)
          setSessionTimeout(d.sessionManagement.sessionTimeout)
          setMaxConcurrentSessions(d.sessionManagement.maxConcurrentSessions)
          setEnforceForAdmins(d.twoFactor.enforceForAdmins)
          setApiKeys(d.apiKeys)
        }
      } catch {
        toast.error('Failed to load security settings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave(section: string) {
    setSaving(section)
    try {
      let payload: Record<string, unknown> = {}
      if (section === 'password') {
        payload = { passwordPolicy: { minLength, requireUppercase, requireNumbers, requireSpecialChars } }
      } else if (section === 'session') {
        payload = { sessionManagement: { sessionTimeout, maxConcurrentSessions } }
      } else if (section === '2fa') {
        payload = { twoFactor: { enforceForAdmins } }
      }

      const res = await apiFetch<{ success: boolean; message?: string }>(
        '/api/v1/admin/security',
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      )
      if (res.success) {
        toast.success(res.message ?? 'Settings saved')
      } else {
        toast.error('Failed to save settings')
      }
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(null)
    }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) return
    try {
      // Store a new API key in tenant settings
      const id = crypto.randomUUID()
      const prefix = 'hs_' + Math.random().toString(36).slice(2, 6)
      const fullKey = 'hs_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      const newKey = {
        id,
        name: newKeyName.trim(),
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        prefix,
        secret: fullKey,
      }

      const res = await apiFetch<{ success: boolean; data: SecuritySettings }>(
        '/api/v1/admin/security'
      )
      if (res.success && res.data) {
        const existingKeys = res.data.apiKeys.map((k) => ({
          id: k.id,
          name: k.name,
          createdAt: k.createdAt,
          lastUsedAt: k.lastUsedAt,
          prefix: k.prefix,
        }))
        existingKeys.push(newKey)

        // Update via the main settings endpoint with apiKeys in security
        const settingsRes = await apiFetch<{ success: boolean }>(
          '/api/v1/admin/settings',
          {
            method: 'PUT',
            body: JSON.stringify({
              settings: {
                security: {
                  apiKeys: existingKeys,
                },
              },
            }),
          }
        )
        if (settingsRes.success) {
          setApiKeys(existingKeys)
          setCreatedKey(fullKey)
          setNewKeyName('')
          toast.success('API key created')
        }
      }
    } catch {
      toast.error('Failed to create API key')
    }
  }

  async function handleRevokeKey(keyId: string) {
    try {
      const remaining = apiKeys.filter((k) => k.id !== keyId)
      const settingsRes = await apiFetch<{ success: boolean }>(
        '/api/v1/admin/settings',
        {
          method: 'PUT',
          body: JSON.stringify({
            settings: {
              security: {
                apiKeys: remaining,
              },
            },
          }),
        }
      )
      if (settingsRes.success) {
        setApiKeys(remaining)
        toast.success('API key revoked')
      }
    } catch {
      toast.error('Failed to revoke API key')
    }
  }

  if (loading) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Security Settings</h1>
          <p className='text-muted-foreground mt-1'>Configure security policies for your organization</p>
        </div>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className='h-48 w-full' />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Security Settings</h1>
        <p className='text-muted-foreground mt-1'>Configure security policies for your organization</p>
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Password Policy */}
        <Card>
          <CardHeader>
            <div className='flex items-center gap-3'>
              <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <KeyRound className='size-5' />
              </div>
              <div>
                <CardTitle className='text-base'>Password Policy</CardTitle>
                <CardDescription>Set minimum length and complexity requirements</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='min-length'>Minimum Length</Label>
              <Input
                id='min-length'
                type='number'
                min={6}
                max={128}
                value={minLength}
                onChange={(e) => setMinLength(Number(e.target.value))}
              />
            </div>
            <Separator />
            <div className='flex items-center justify-between gap-4'>
              <Label htmlFor='req-upper'>Require uppercase letters</Label>
              <Switch id='req-upper' checked={requireUppercase} onCheckedChange={setRequireUppercase} />
            </div>
            <div className='flex items-center justify-between gap-4'>
              <Label htmlFor='req-numbers'>Require numbers</Label>
              <Switch id='req-numbers' checked={requireNumbers} onCheckedChange={setRequireNumbers} />
            </div>
            <div className='flex items-center justify-between gap-4'>
              <Label htmlFor='req-special'>Require special characters</Label>
              <Switch id='req-special' checked={requireSpecialChars} onCheckedChange={setRequireSpecialChars} />
            </div>
            <div className='flex justify-end'>
              <Button onClick={() => handleSave('password')} disabled={saving !== null}>
                {saving === 'password' && <Loader2 className='mr-2 size-4 animate-spin' />}
                Save Password Policy
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Session Management */}
        <Card>
          <CardHeader>
            <div className='flex items-center gap-3'>
              <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <Smartphone className='size-5' />
              </div>
              <div>
                <CardTitle className='text-base'>Session Management</CardTitle>
                <CardDescription>Control session duration and concurrency</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='session-timeout'>Session Timeout (minutes)</Label>
              <Input
                id='session-timeout'
                type='number'
                min={1}
                max={1440}
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(Number(e.target.value))}
              />
              <p className='text-xs text-muted-foreground'>Max session duration before re-auth</p>
            </div>
            <Separator />
            <div className='space-y-2'>
              <Label htmlFor='max-concurrent'>Max Concurrent Sessions</Label>
              <Input
                id='max-concurrent'
                type='number'
                min={1}
                max={20}
                value={maxConcurrentSessions}
                onChange={(e) => setMaxConcurrentSessions(Number(e.target.value))}
              />
              <p className='text-xs text-muted-foreground'>Maximum simultaneous sessions per user</p>
            </div>
            <div className='flex justify-end'>
              <Button onClick={() => handleSave('session')} disabled={saving !== null}>
                {saving === 'session' && <Loader2 className='mr-2 size-4 animate-spin' />}
                Save Sessions
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <Card>
          <CardHeader>
            <div className='flex items-center gap-3'>
              <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <ShieldCheck className='size-5' />
              </div>
              <div>
                <CardTitle className='text-base'>Two-Factor Authentication</CardTitle>
                <CardDescription>Enforce 2FA for admin-level roles</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-center justify-between gap-4'>
              <div className='space-y-0.5'>
                <Label htmlFor='enforce-2fa-admin'>Enforce 2FA for admins</Label>
                <p className='text-xs text-muted-foreground'>
                  Require two-factor authentication for all admin and owner roles
                </p>
              </div>
              <Switch id='enforce-2fa-admin' checked={enforceForAdmins} onCheckedChange={setEnforceForAdmins} />
            </div>
            <div className='flex justify-end'>
              <Button onClick={() => handleSave('2fa')} disabled={saving !== null}>
                {saving === '2fa' && <Loader2 className='mr-2 size-4 animate-spin' />}
                Save 2FA Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between gap-2'>
              <div className='flex items-center gap-3'>
                <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                  <Key className='size-5' />
                </div>
                <div>
                  <CardTitle className='text-base'>API Keys</CardTitle>
                  <CardDescription>Manage keys for programmatic access</CardDescription>
                </div>
              </div>
              <Button variant='outline' size='sm' onClick={() => { setCreateKeyOpen(true); setCreatedKey(null) }}>
                <Plus className='mr-1 size-4' />
                Create
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {apiKeys.length === 0 ? (
              <p className='text-sm text-muted-foreground'>No API keys configured</p>
            ) : (
              <div className='space-y-3'>
                {apiKeys.map((key) => (
                  <div key={key.id} className='flex items-center justify-between gap-3 rounded-md border px-3 py-2'>
                    <div className='min-w-0'>
                      <p className='text-sm font-medium truncate'>{key.name}</p>
                      <p className='text-xs text-muted-foreground'>
                        {key.prefix}… · Created {new Date(key.createdAt).toLocaleDateString()}
                        {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Button variant='ghost' size='icon' className='shrink-0 text-destructive' onClick={() => handleRevokeKey(key.id)}>
                      <Trash2 className='size-4' />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create API Key Dialog */}
      <Dialog open={createKeyOpen} onOpenChange={setCreateKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              {createdKey
                ? 'Copy your API key now. You won\'t be able to see it again.'
                : 'Generate a new API key for programmatic access.'}
            </DialogDescription>
          </DialogHeader>
          {createdKey ? (
            <div className='space-y-3'>
              <Input readOnly value={createdKey} className='font-mono text-xs' />
              <Button
                variant='outline'
                onClick={() => { navigator.clipboard.writeText(createdKey); toast.success('Copied to clipboard') }}
              >
                Copy to Clipboard
              </Button>
            </div>
          ) : (
            <div className='space-y-3'>
              <div className='space-y-2'>
                <Label htmlFor='key-name'>Key Name</Label>
                <Input
                  id='key-name'
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder='e.g. CI/CD Pipeline'
                />
              </div>
            </div>
          )}
          <DialogFooter>
            {createdKey ? (
              <Button onClick={() => setCreateKeyOpen(false)}>Done</Button>
            ) : (
              <Button onClick={handleCreateKey} disabled={!newKeyName.trim()}>
                Create Key
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
