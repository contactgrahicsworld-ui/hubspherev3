'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ToggleLeft, AlertCircle, Info } from 'lucide-react'

interface FeatureFlag {
  id: string
  name: string
  key: string
  description: string
  enabled: boolean
  environment: string
  createdAt: string
  updatedAt: string
}

interface FlagsResponse {
  data: FeatureFlag[]
}

const PLACEHOLDER_FLAGS: FeatureFlag[] = [
  {
    id: 'placeholder-1',
    name: 'Advanced Analytics',
    key: 'ADVANCED_ANALYTICS',
    description: 'Enable detailed analytics dashboards and reporting features for tenants.',
    enabled: false,
    environment: 'global',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'placeholder-2',
    name: 'Custom Branding',
    key: 'CUSTOM_BRANDING',
    description: 'Allow tenants to customize their branding, logos, and color themes.',
    enabled: false,
    environment: 'global',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'placeholder-3',
    name: 'API Rate Limiting',
    key: 'API_RATE_LIMITING',
    description: 'Enable rate limiting on API endpoints to prevent abuse.',
    enabled: true,
    environment: 'global',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'placeholder-4',
    name: 'Two-Factor Authentication',
    key: 'TWO_FACTOR_AUTH',
    description: 'Require two-factor authentication for all user accounts.',
    enabled: false,
    environment: 'global',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'placeholder-5',
    name: 'SSO Integration',
    key: 'SSO_INTEGRATION',
    description: 'Enable SAML/OIDC single sign-on for enterprise tenants.',
    enabled: false,
    environment: 'global',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'placeholder-6',
    name: 'Webhook Notifications',
    key: 'WEBHOOK_NOTIFICATIONS',
    description: 'Allow tenants to configure webhook endpoints for event notifications.',
    enabled: true,
    environment: 'global',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

function FlagsSkeleton() {
  return (
    <div className='space-y-3'>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div className='space-y-2 flex-1'>
                <Skeleton className='h-4 w-40' />
                <Skeleton className='h-3 w-64' />
              </div>
              <Skeleton className='h-5 w-9 rounded-full' />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function FeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usePlaceholder, setUsePlaceholder] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchFlags() {
      try {
        setLoading(true)
        setError(null)
        const data = await apiFetch<FlagsResponse>('/api/v1/super-admin/features')
        if (!cancelled) {
          setFlags(data.data)
          setUsePlaceholder(false)
        }
      } catch {
        if (!cancelled) {
          setFlags(PLACEHOLDER_FLAGS)
          setUsePlaceholder(true)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchFlags()
    return () => {
      cancelled = true
    }
  }, [])

  const handleToggle = (flagId: string, checked: boolean) => {
    if (usePlaceholder) {
      toast.info('Feature flags API is not yet available. Toggle will be functional once the backend is implemented.')
      return
    }
    setFlags((prev) =>
      prev.map((f) => (f.id === flagId ? { ...f, enabled: checked } : f))
    )
    toast.success(`Feature flag ${checked ? 'enabled' : 'disabled'}`)
  }

  const enabledCount = flags.filter((f) => f.enabled).length

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Feature Flags</h1>
        <p className='text-muted-foreground mt-1'>
          Control platform features and capabilities
        </p>
      </div>

      {usePlaceholder && !loading && (
        <Card className='border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20'>
          <CardContent className='flex items-start gap-3 py-4'>
            <Info className='size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5' />
            <div>
              <p className='text-sm font-medium text-amber-800 dark:text-amber-300'>
                Placeholder Mode
              </p>
              <p className='text-xs text-amber-700 dark:text-amber-400 mt-0.5'>
                The feature flags API endpoint is not yet available. Showing sample flags to demonstrate the UI architecture.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && <FlagsSkeleton />}

      {error && !loading && !usePlaceholder && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-6'>
            <AlertCircle className='size-5 text-destructive shrink-0' />
            <p className='text-sm text-destructive'>{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && flags.length === 0 && !usePlaceholder && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <ToggleLeft className='size-10 text-muted-foreground/50 mb-3' />
            <p className='text-sm font-medium text-muted-foreground'>No feature flags</p>
            <p className='text-xs text-muted-foreground mt-1'>
              Feature flags can be created once the flags service is configured.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && flags.length > 0 && (
        <>
          <div className='flex items-center gap-3 text-sm text-muted-foreground'>
            <span>{enabledCount} of {flags.length} flags enabled</span>
            <Badge variant='secondary'>{flags.length} total</Badge>
          </div>

          <div className='space-y-3'>
            {flags.map((flag) => (
              <Card key={flag.id}>
                <CardContent className='p-4'>
                  <div className='flex items-start justify-between gap-4'>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2'>
                        <p className='font-medium text-sm'>{flag.name}</p>
                        <Badge variant='outline' className='font-mono text-[10px] px-1.5'>
                          {flag.key}
                        </Badge>
                      </div>
                      <p className='text-xs text-muted-foreground mt-1'>{flag.description}</p>
                    </div>
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={(checked) => handleToggle(flag.id, checked)}
                      aria-label={`Toggle ${flag.name}`}
                      className='shrink-0 mt-0.5'
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
