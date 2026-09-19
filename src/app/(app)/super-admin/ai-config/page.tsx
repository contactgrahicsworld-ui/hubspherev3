'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Brain, CheckCircle2, XCircle, Loader2, RefreshCw, Save, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

// ============================================
// TYPES
// ============================================

interface ProviderConfig {
  providerId: string
  name: string
  category: string
  enabled: boolean
  configured: boolean
  healthy: boolean | null
  priority: number
  defaultModel?: string
  apiKeySet?: boolean
}

interface UsageStats {
  totalTokens: number
  totalCost: number
  callsPerDay: number
  byProvider: Record<string, { tokens: number; cost: number; calls: number }>
}

interface TenantAIFeature {
  tenantId: string
  tenantName: string
  aiEnabled: boolean
}

interface AIConfigData {
  providers: ProviderConfig[]
  usage: UsageStats
  tenantFeatures: TenantAIFeature[]
}

// ============================================
// MODEL OPTIONS PER PROVIDER
// ============================================

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini'],
  'google-ai': ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
}

// ============================================
// COMPONENT
// ============================================

export default function AIConfigPage() {
  const [data, setData] = useState<AIConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [savingProvider, setSavingProvider] = useState<string | null>(null)
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [models, setModels] = useState<Record<string, string>>({})
  const [priorities, setPriorities] = useState<Record<string, number>>({})
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [healthResults, setHealthResults] = useState<Record<string, boolean | null>>({})

  // ---- Fetch data ----
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiFetch<AIConfigData>('/api/v1/super-admin/ai-config')
      setData(result)
      // Initialize local state from fetched data
      const initialModels: Record<string, string> = {}
      const initialPriorities: Record<string, number> = {}
      result.providers.forEach((p) => {
        initialModels[p.providerId] = p.defaultModel ?? ''
        initialPriorities[p.providerId] = p.priority
      })
      setModels(initialModels)
      setPriorities(initialPriorities)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ---- Test provider connection ----
  const handleHealthCheck = async (providerId: string) => {
    setTestingProvider(providerId)
    setHealthResults((prev) => ({ ...prev, [providerId]: null }))
    try {
      const result = await apiFetch<{ healthy: boolean }>(
        `/api/v1/super-admin/ai-config?test=${providerId}`,
      )
      setHealthResults((prev) => ({ ...prev, [providerId]: result.healthy }))
      toast.success(
        result.healthy
          ? `${providerId} connection successful`
          : `${providerId} connection failed`,
      )
    } catch {
      setHealthResults((prev) => ({ ...prev, [providerId]: false }))
      toast.error(`Failed to test ${providerId}`)
    } finally {
      setTestingProvider(null)
    }
  }

  // ---- Save provider config ----
  const handleSave = async (providerId: string) => {
    setSavingProvider(providerId)
    try {
      const patchData: Record<string, unknown> = {}

      if (apiKeys[providerId]) {
        patchData.apiKey = apiKeys[providerId]
      }
      if (models[providerId] !== undefined) {
        patchData.defaultModel = models[providerId]
      }
      if (priorities[providerId] !== undefined) {
        patchData.priority = priorities[providerId]
      }

      await apiFetch(`/api/v1/super-admin/ai-config`, {
        method: 'PATCH',
        body: JSON.stringify({ providerId, ...patchData }),
      })

      toast.success(`${providerId} configuration saved`)
      // Clear the local API key after saving
      setApiKeys((prev) => {
        const next = { ...prev }
        delete next[providerId]
        return next
      })
      // Refresh data
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setSavingProvider(null)
    }
  }

  // ---- Toggle AI for tenant ----
  const handleToggleTenantAI = async (tenantId: string, aiEnabled: boolean) => {
    try {
      await apiFetch('/api/v1/super-admin/ai-config', {
        method: 'PATCH',
        body: JSON.stringify({ tenantId, aiEnabled }),
      })
      toast.success(`AI ${aiEnabled ? 'enabled' : 'disabled'} for tenant`)
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle AI feature')
    }
  }

  // ---- Toggle provider enabled ----
  const handleToggleProvider = async (providerId: string, enabled: boolean) => {
    try {
      await apiFetch('/api/v1/super-admin/ai-config', {
        method: 'PATCH',
        body: JSON.stringify({ providerId, enabled }),
      })
      toast.success(`${providerId} ${enabled ? 'enabled' : 'disabled'}`)
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle provider')
    }
  }

  // ============================================
  // RENDER — Loading
  // ============================================

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Manage AI providers, models, and usage
          </p>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // ============================================
  // RENDER — Error
  // ============================================

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Manage AI providers, models, and usage
          </p>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  // ============================================
  // RENDER — Empty / No data
  // ============================================

  if (!data || data.providers.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Manage AI providers, models, and usage
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Brain className="size-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No AI providers configured</p>
            <p className="text-xs text-muted-foreground mt-1">
              Provider configurations will appear here once bootstrapped.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ============================================
  // RENDER — Main
  // ============================================

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Manage AI providers, models, and usage
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* ---- Provider Cards ---- */}
      {data.providers.map((provider) => {
        const isTesting = testingProvider === provider.providerId
        const isSaving = savingProvider === provider.providerId
        const healthResult = healthResults[provider.providerId]
        const availableModels = PROVIDER_MODELS[provider.providerId] ?? []

        return (
          <Card key={provider.providerId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{provider.name}</CardTitle>
                    <CardDescription>{provider.category}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Status badges */}
                  {!provider.configured && (
                    <Badge variant="secondary">Not Configured</Badge>
                  )}
                  {provider.configured && !provider.enabled && (
                    <Badge variant="outline">Disabled</Badge>
                  )}
                  {provider.configured && provider.enabled && (
                    <Badge variant="default" className="bg-green-600">
                      Active
                    </Badge>
                  )}

                  {/* Health indicator */}
                  {healthResult === true && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {healthResult === false && (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}

                  {/* Enable toggle */}
                  <Switch
                    checked={provider.enabled}
                    disabled={!provider.configured}
                    onCheckedChange={(checked) =>
                      handleToggleProvider(provider.providerId, checked)
                    }
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* API Key */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">API Key</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKeys[provider.providerId] ? 'text' : 'password'}
                      placeholder={
                        provider.apiKeySet
                          ? '•••••••• (key is set)'
                          : 'Enter API key'
                      }
                      value={apiKeys[provider.providerId] ?? ''}
                      onChange={(e) =>
                        setApiKeys((prev) => ({
                          ...prev,
                          [provider.providerId]: e.target.value,
                        }))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() =>
                        setShowKeys((prev) => ({
                          ...prev,
                          [provider.providerId]: !prev[provider.providerId],
                        }))
                      }
                    >
                      {showKeys[provider.providerId] ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Default Model */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">Default Model</label>
                {availableModels.length > 0 ? (
                  <Select
                    value={models[provider.providerId] ?? ''}
                    onValueChange={(value) =>
                      setModels((prev) => ({ ...prev, [provider.providerId]: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={models[provider.providerId] ?? ''}
                    onChange={(e) =>
                      setModels((prev) => ({
                        ...prev,
                        [provider.providerId]: e.target.value,
                      }))
                    }
                    placeholder="e.g., gpt-4o"
                  />
                )}
              </div>

              {/* Priority */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">Priority</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={priorities[provider.providerId] ?? provider.priority}
                  onChange={(e) =>
                    setPriorities((prev) => ({
                      ...prev,
                      [provider.providerId]: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className="w-24"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleSave(provider.providerId)}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleHealthCheck(provider.providerId)}
                  disabled={isTesting || !provider.configured}
                >
                  {isTesting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* ---- Usage Statistics ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Statistics</CardTitle>
          <CardDescription>AI usage across all tenants</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Tokens</p>
              <p className="text-2xl font-bold">
                {data.usage.totalTokens.toLocaleString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="text-2xl font-bold">${data.usage.totalCost.toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Calls / Day</p>
              <p className="text-2xl font-bold">{data.usage.callsPerDay.toLocaleString()}</p>
            </div>
          </div>

          {Object.keys(data.usage.byProvider).length > 0 && (
            <Table className="mt-6">
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(data.usage.byProvider).map(([providerId, stats]) => (
                  <TableRow key={providerId}>
                    <TableCell className="font-medium">{providerId}</TableCell>
                    <TableCell className="text-right">
                      {stats.tokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">${stats.cost.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {stats.calls.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ---- Tenant AI Feature Toggle ---- */}
      {data.tenantFeatures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tenant AI Access</CardTitle>
            <CardDescription>Toggle AI features for individual tenants</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="text-right">AI Enabled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.tenantFeatures.map((tenant) => (
                  <TableRow key={tenant.tenantId}>
                    <TableCell className="font-medium">{tenant.tenantName}</TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={tenant.aiEnabled}
                        onCheckedChange={(checked) =>
                          handleToggleTenantAI(tenant.tenantId, checked)
                        }
                      />
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
