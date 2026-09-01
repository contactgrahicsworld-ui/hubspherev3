'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertCircle,
 Settings,
 MessageSquare,
  Mail,
  Smartphone,
  Bell,
  Eye,
  EyeOff,
  Save,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProviderCardSkeleton } from '@/components/skeletons'

// ============================================
// Types
// ============================================

interface ProviderInfo {
  channel: string
  provider: string | null
  status: string
  enabled: boolean
  config: Record<string, string> | null
}

interface ProvidersResponse {
  success: boolean
  data: ProviderInfo[]
}

// ============================================
// Constants
// ============================================

const CHANNEL_CONFIG: Record<
  string,
  {
    label: string
    icon: React.ReactNode
    color: string
    fields: { key: string; label: string; type: 'text' | 'password' | 'number'; placeholder: string }[]
  }
> = {
  WHATSAPP: {
    label: 'WhatsApp',
    icon: <MessageSquare className='size-5' />,
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    fields: [
      { key: 'providerUrl', label: 'Provider URL', type: 'text', placeholder: 'https://graph.facebook.com/v17.0' },
      { key: 'apiToken', label: 'API Token', type: 'password', placeholder: 'Enter API token' },
      { key: 'phoneNumberId', label: 'Phone Number ID', type: 'text', placeholder: 'Enter phone number ID' },
    ],
  },
  EMAIL: {
    label: 'Email (SMTP)',
    icon: <Mail className='size-5' />,
    color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
    fields: [
      { key: 'smtpHost', label: 'SMTP Host', type: 'text', placeholder: 'smtp.example.com' },
      { key: 'smtpPort', label: 'Port', type: 'number', placeholder: '587' },
      { key: 'smtpUser', label: 'SMTP User', type: 'text', placeholder: 'user@example.com' },
      { key: 'smtpPassword', label: 'SMTP Password', type: 'password', placeholder: 'Enter password' },
      { key: 'fromAddress', label: 'From Address', type: 'text', placeholder: 'noreply@example.com' },
    ],
  },
  SMS: {
    label: 'SMS Gateway',
    icon: <Smartphone className='size-5' />,
    color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    fields: [
      { key: 'provider', label: 'Provider', type: 'text', placeholder: 'twilio, vonage, etc.' },
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Enter API key' },
      { key: 'fromNumber', label: 'From Number', type: 'text', placeholder: '+1234567890' },
    ],
  },
  PUSH: {
    label: 'Push Notifications',
    icon: <Bell className='size-5' />,
    color: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
    fields: [
      { key: 'providerKey', label: 'Provider Key', type: 'password', placeholder: 'Enter provider key' },
    ],
  },
}

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeStyle: string; icon: React.ReactNode }
> = {
  NOT_CONFIGURED: {
    label: 'Not Configured',
    badgeStyle: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: <ShieldX className='size-4' />,
  },
  CONFIGURED: {
    label: 'Configured',
    badgeStyle: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: <ShieldCheck className='size-4' />,
  },
  ENABLED: {
    label: 'Enabled',
    badgeStyle: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: <ShieldAlert className='size-4' />,
  },
}

// ============================================
// Helpers
// ============================================

function maskValue(value: string): string {
  if (!value) return '—'
  if (value.length <= 4) return '****'
  return value.substring(0, 3) + '*'.repeat(Math.min(value.length - 3, 12))
}


// ============================================
// Configure Dialog
// ============================================

function ConfigureDialog({
  open,
  onOpenChange,
  provider,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  provider: ProviderInfo | null
  onSuccess: () => void
}) {
  const channel = provider?.channel || ''
  const configDef = CHANNEL_CONFIG[channel]
  const fields = configDef?.fields || []

  const [formData, setFormData] = useState<Record<string, string>>({})
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (provider && open) {
      // Pre-fill with existing masked values for display purposes,
      // but empty password fields so user can enter new ones
      const initial: Record<string, string> = {}
      fields.forEach((f) => {
        const val = provider.config?.[f.key]
        initial[f.key] = f.type === 'password' ? '' : (val || '')
      })
      setFormData(initial)
      setShowSecrets({})
    }
  }, [provider, open, fields])

  const handleSave = async () => {
    try {
      setSaving(true)
      // Only send non-empty values (don't send empty password fields)
      const payload: Record<string, string> = {}
      for (const [key, val] of Object.entries(formData)) {
        if (val.trim()) payload[key] = val.trim()
      }

      await apiFetch(`/api/v1/communication/providers/${channel}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      toast.success(`${configDef?.label || channel} provider updated`)
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save configuration'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {configDef?.icon}
            Configure {configDef?.label || channel}
          </DialogTitle>
          <DialogDescription>
            {provider?.status === 'NOT_CONFIGURED'
              ? 'Set up the provider credentials to start using this channel.'
              : 'Update the provider configuration. Leave password fields blank to keep existing values.'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {fields.map((field) => (
            <div key={field.key} className='space-y-2'>
              <Label htmlFor={`cfg-${field.key}`}>{field.label}</Label>
              <div className='relative'>
                <Input
                  id={`cfg-${field.key}`}
                  type={
                    field.type === 'password'
                      ? showSecrets[field.key]
                        ? 'text'
                        : 'password'
                      : field.type
                  }
                  placeholder={field.placeholder}
                  value={formData[field.key] || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                />
                {field.type === 'password' && (
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2'
                    onClick={() =>
                      setShowSecrets((prev) => ({
                        ...prev,
                        [field.key]: !prev[field.key],
                      }))
                    }
                    aria-label={showSecrets[field.key] ? 'Hide value' : 'Show value'}
                  >
                    {showSecrets[field.key] ? (
                      <EyeOff className='size-3.5' />
                    ) : (
                      <Eye className='size-3.5' />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className='size-4 animate-spin' />
                Saving...
              </>
            ) : (
              <>
                <Save className='size-4' />
                Save Configuration
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Main Page
// ============================================

export default function ProviderSettingsPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dbUnavailable, setDbUnavailable] = useState(false)

  // Configure dialog
  const [configTarget, setConfigTarget] = useState<ProviderInfo | null>(null)

  // Toggle enabled
  const [togglingChannel, setTogglingChannel] = useState<string | null>(null)

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setDbUnavailable(false)
      const res = await apiFetch<ProvidersResponse>('/api/v1/communication/providers')
      setProviders(res.data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load providers'
      if (msg.includes('Database unavailable') || msg.includes('503')) {
        setDbUnavailable(true)
        setError('Database is currently unavailable. Please try again later.')
      } else {
        setError(msg)
      }
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  const toggleEnabled = async (channel: string, enabled: boolean) => {
    try {
      setTogglingChannel(channel)
      await apiFetch(`/api/v1/communication/providers/${channel}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      })
      setProviders((prev) =>
        prev.map((p) =>
          p.channel === channel
            ? { ...p, enabled, status: enabled ? 'ENABLED' : 'CONFIGURED' }
            : p
        )
      )
      toast.success(
        `${CHANNEL_CONFIG[channel]?.label || channel} ${enabled ? 'enabled' : 'disabled'}`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update provider'
      toast.error(msg)
    } finally {
      setTogglingChannel(null)
    }
  }

  // ---- Loading State ----
  if (loading) {
    return (
      <div className='space-y-6'>
        <div>
          <Skeleton className='h-8 w-48' />
          <Skeleton className='mt-1 h-4 w-64' />
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          {Array.from({ length: 4 }).map((_, i) => (
            <ProviderCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  // ---- Error / DB Unavailable State ----
  if (error || !providers.length) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Provider Settings</h1>
          <p className='mt-1 text-muted-foreground'>Configure communication channels</p>
        </div>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertCircle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>
              {dbUnavailable
                ? 'Service Temporarily Unavailable'
                : error || 'Failed to load providers'}
            </p>
            {dbUnavailable && (
              <p className='text-xs text-muted-foreground'>
                The database is not responding. This is usually a temporary issue.
              </p>
            )}
            <button
              onClick={fetchProviders}
              className='mt-2 text-sm text-primary underline-offset-4 hover:underline'
            >
              Try again
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Provider Settings</h1>
        <p className='mt-1 text-muted-foreground'>
          Configure communication channels and providers
        </p>
      </div>

      {/* Provider Cards */}
      <div className='grid gap-4 sm:grid-cols-2'>
        {providers.map((provider) => {
          const channelDef = CHANNEL_CONFIG[provider.channel]
          const statusDef = STATUS_CONFIG[provider.status] || STATUS_CONFIG.NOT_CONFIGURED
          const isToggling = togglingChannel === provider.channel

          return (
            <Card key={provider.channel}>
              <CardContent className='p-6'>
                {/* Top Row */}
                <div className='flex items-start justify-between gap-4'>
                  <div className='flex items-center gap-3'>
                    <div
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-lg',
                        channelDef?.color || 'bg-muted text-muted-foreground'
                      )}
                    >
                      {channelDef?.icon || <Settings className='size-5' />}
                    </div>
                    <div>
                      <p className='font-semibold'>{channelDef?.label || provider.channel}</p>
                      <p className='text-xs text-muted-foreground'>
                        {provider.provider || 'No provider configured'}
                      </p>
                    </div>
                  </div>
                  <Badge variant='outline' className={statusDef.badgeStyle}>
                    {statusDef.icon}
                    <span className='ml-1'>{statusDef.label}</span>
                  </Badge>
                </div>

                {/* Config Summary */}
                {provider.config && Object.keys(provider.config).length > 0 && (
                  <div className='mt-4 space-y-1.5 rounded-md border bg-muted/30 p-3'>
                    {Object.entries(provider.config).map(([key, value]) => {
                      const fieldDef = channelDef?.fields.find((f) => f.key === key)
                      const isSecret = fieldDef?.type === 'password'
                      return (
                        <div
                          key={key}
                          className='flex items-center justify-between text-xs'
                        >
                          <span className='text-muted-foreground'>
                            {fieldDef?.label || key}
                          </span>
                          <span className='font-mono text-muted-foreground'>
                            {isSecret ? maskValue(value) : value || '—'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Actions */}
                <div className='mt-4 flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <Switch
                      id={`toggle-${provider.channel}`}
                      checked={provider.enabled}
                      disabled={
                        isToggling || provider.status === 'NOT_CONFIGURED'
                      }
                      onCheckedChange={(checked) =>
                        toggleEnabled(provider.channel, checked)
                      }
                      aria-label={`Toggle ${channelDef?.label || provider.channel}`}
                    />
                    <Label
                      htmlFor={`toggle-${provider.channel}`}
                      className='text-xs text-muted-foreground'
                    >
                      {provider.enabled ? 'Enabled' : 'Disabled'}
                    </Label>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setConfigTarget(provider)}
                  >
                    <Settings className='size-3.5' />
                    Configure
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Configure Dialog */}
      <ConfigureDialog
        open={!!configTarget}
        onOpenChange={(v) => !v && setConfigTarget(null)}
        provider={configTarget}
        onSuccess={fetchProviders}
      />
    </div>
  )
}
