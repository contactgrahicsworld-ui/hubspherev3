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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Settings, Shield, Mail, HardDrive, Loader2 } from 'lucide-react'

interface GeneralSettings {
  tenantName: string
  domain: string
  logoUrl: string
}
interface SecuritySettings {
  sessionTimeout: number
  passwordMinLength: number
  enforce2FA: boolean
}
interface EmailSettings {
  provider: string
  fromEmail: string
  apiKeyConfigured: boolean
}
interface StorageSettings {
  provider: string
  bucketName: string
  region: string
}
interface EnvStatus {
  resendConfigured: boolean
  sendgridConfigured: boolean
  smtpConfigured: boolean
  supabaseConfigured: boolean
  awsConfigured: boolean
}
interface PlatformSettings {
  general: GeneralSettings
  security: SecuritySettings
  email: EmailSettings
  storage: StorageSettings
  env: EnvStatus
}

export default function PlatformSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [env, setEnv] = useState<EnvStatus>({
    resendConfigured: false,
    sendgridConfigured: false,
    smtpConfigured: false,
    supabaseConfigured: false,
    awsConfigured: false,
  })

  // General
  const [tenantName, setTenantName] = useState('')
  const [domain, setDomain] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  // Security
  const [sessionTimeout, setSessionTimeout] = useState(30)
  const [passwordMinLength, setPasswordMinLength] = useState(8)
  const [enforce2FA, setEnforce2FA] = useState(false)

  // Email
  const [emailProvider, setEmailProvider] = useState('resend')
  const [fromEmail, setFromEmail] = useState('')
  const [emailApiKey, setEmailApiKey] = useState('')

  // Storage
  const [storageProvider, setStorageProvider] = useState('supabase')
  const [bucketName, setBucketName] = useState('')
  const [region, setRegion] = useState('')

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await apiFetch<{ success: boolean; data: PlatformSettings }>(
          '/api/v1/super-admin/settings'
        )
        if (res.success && res.data) {
          const d = res.data
          setTenantName(d.general.tenantName)
          setDomain(d.general.domain ?? '')
          setLogoUrl(d.general.logoUrl ?? '')
          setSessionTimeout(d.security.sessionTimeout)
          setPasswordMinLength(d.security.passwordMinLength)
          setEnforce2FA(d.security.enforce2FA)
          setEmailProvider(d.email.provider)
          setFromEmail(d.email.fromEmail)
          setStorageProvider(d.storage.provider)
          setBucketName(d.storage.bucketName)
          setRegion(d.storage.region)
          setEnv(d.env)
        }
      } catch {
        toast.error('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  async function handleSave(section: string) {
    setSaving(true)
    try {
      let payload: Record<string, unknown> = {}
      if (section === 'general') {
        payload = { general: { tenantName, domain, logoUrl } }
      } else if (section === 'security') {
        payload = { security: { sessionTimeout, passwordMinLength, enforce2FA } }
      } else if (section === 'email') {
        payload = { email: { provider: emailProvider, fromEmail, apiKey: emailApiKey } }
      } else if (section === 'storage') {
        payload = { storage: { provider: storageProvider, bucketName, region } }
      }

      const res = await apiFetch<{ success: boolean; message?: string }>(
        '/api/v1/super-admin/settings',
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      )
      if (res.success) {
        toast.success(res.message ?? 'Settings saved')
        if (section === 'email') setEmailApiKey('')
      } else {
        toast.error('Failed to save settings')
      }
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Platform Settings</h1>
          <p className='text-muted-foreground mt-1'>Configure global platform settings and preferences</p>
        </div>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className='h-48 w-full' />
        ))}
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Platform Settings</h1>
        <p className='text-muted-foreground mt-1'>Configure global platform settings and preferences</p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <div className='rounded-lg bg-muted p-2 shrink-0'>
              <Settings className='size-4 text-muted-foreground' />
            </div>
            <div>
              <CardTitle className='text-base'>General</CardTitle>
              <CardDescription>Platform name, domain, and branding</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='tenant-name'>Tenant Name</Label>
            <Input
              id='tenant-name'
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder='Acme Inc'
            />
          </div>
          <Separator />
          <div className='space-y-2'>
            <Label htmlFor='domain'>Domain</Label>
            <Input
              id='domain'
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder='acme.example.com'
            />
            <p className='text-xs text-muted-foreground'>Custom domain for this tenant</p>
          </div>
          <Separator />
          <div className='space-y-2'>
            <Label htmlFor='logo-url'>Logo URL</Label>
            <Input
              id='logo-url'
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder='https://cdn.example.com/logo.png'
            />
          </div>
          <div className='flex justify-end'>
            <Button onClick={() => handleSave('general')} disabled={saving}>
              {saving && <Loader2 className='mr-2 size-4 animate-spin' />}
              Save General
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <div className='rounded-lg bg-muted p-2 shrink-0'>
              <Shield className='size-4 text-muted-foreground' />
            </div>
            <div>
              <CardTitle className='text-base'>Security</CardTitle>
              <CardDescription>Session timeout, password policy, and 2FA enforcement</CardDescription>
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
            <p className='text-xs text-muted-foreground'>Maximum session duration before re-authentication is required</p>
          </div>
          <Separator />
          <div className='space-y-2'>
            <Label htmlFor='password-min-length'>Password Minimum Length</Label>
            <Input
              id='password-min-length'
              type='number'
              min={6}
              max={128}
              value={passwordMinLength}
              onChange={(e) => setPasswordMinLength(Number(e.target.value))}
            />
          </div>
          <Separator />
          <div className='flex items-center justify-between gap-4'>
            <div className='space-y-0.5'>
              <Label htmlFor='enforce-2fa'>Enforce Two-Factor Authentication</Label>
              <p className='text-xs text-muted-foreground'>Require all users to set up 2FA</p>
            </div>
            <Switch
              id='enforce-2fa'
              checked={enforce2FA}
              onCheckedChange={setEnforce2FA}
            />
          </div>
          <div className='flex justify-end'>
            <Button onClick={() => handleSave('security')} disabled={saving}>
              {saving && <Loader2 className='mr-2 size-4 animate-spin' />}
              Save Security
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Settings */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <div className='rounded-lg bg-muted p-2 shrink-0'>
              <Mail className='size-4 text-muted-foreground' />
            </div>
            <div>
              <CardTitle className='text-base'>Email</CardTitle>
              <CardDescription>Transactional email provider and configuration</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label>Provider</Label>
            <Select value={emailProvider} onValueChange={setEmailProvider}>
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='resend'>Resend {env.resendConfigured ? '✓' : '(not configured)'}</SelectItem>
                <SelectItem value='sendgrid'>SendGrid {env.sendgridConfigured ? '✓' : '(not configured)'}</SelectItem>
                <SelectItem value='smtp'>SMTP {env.smtpConfigured ? '✓' : '(not configured)'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className='space-y-2'>
            <Label htmlFor='from-email'>From Email</Label>
            <Input
              id='from-email'
              type='email'
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder='noreply@example.com'
            />
          </div>
          <Separator />
          <div className='space-y-2'>
            <Label htmlFor='email-api-key'>API Key</Label>
            <Input
              id='email-api-key'
              type='password'
              value={emailApiKey}
              onChange={(e) => setEmailApiKey(e.target.value)}
              placeholder={env.resendConfigured || env.sendgridConfigured ? '•••••••• (configured)' : 'Enter API key'}
            />
            <p className='text-xs text-muted-foreground'>
              {emailProvider === 'resend' && env.resendConfigured && 'Resend API key is configured via environment'}
              {emailProvider === 'sendgrid' && env.sendgridConfigured && 'SendGrid API key is configured via environment'}
              {emailProvider === 'smtp' && env.smtpConfigured && 'SMTP credentials are configured via environment'}
            </p>
          </div>
          <div className='flex justify-end'>
            <Button onClick={() => handleSave('email')} disabled={saving}>
              {saving && <Loader2 className='mr-2 size-4 animate-spin' />}
              Save Email
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Storage Settings */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <div className='rounded-lg bg-muted p-2 shrink-0'>
              <HardDrive className='size-4 text-muted-foreground' />
            </div>
            <div>
              <CardTitle className='text-base'>Storage</CardTitle>
              <CardDescription>File storage provider and bucket configuration</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label>Provider</Label>
            <Select value={storageProvider} onValueChange={setStorageProvider}>
              <SelectTrigger className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='supabase'>Supabase Storage {env.supabaseConfigured ? '✓' : '(not configured)'}</SelectItem>
                <SelectItem value='aws-s3'>AWS S3 {env.awsConfigured ? '✓' : '(not configured)'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className='space-y-2'>
            <Label htmlFor='bucket-name'>Bucket Name</Label>
            <Input
              id='bucket-name'
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
              placeholder='my-bucket'
            />
          </div>
          <Separator />
          <div className='space-y-2'>
            <Label htmlFor='region'>Region</Label>
            <Input
              id='region'
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder='us-east-1'
            />
          </div>
          <div className='flex justify-end'>
            <Button onClick={() => handleSave('storage')} disabled={saving}>
              {saving && <Loader2 className='mr-2 size-4 animate-spin' />}
              Save Storage
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
