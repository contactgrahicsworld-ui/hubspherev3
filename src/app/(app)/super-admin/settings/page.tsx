'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Settings, Shield, Mail, HardDrive, Wrench } from 'lucide-react'

interface SettingSection {
  id: string
  title: string
  description: string
  icon: React.ElementType
  items: string[]
}

const settingSections: SettingSection[] = [
  {
    id: 'general',
    title: 'General',
    description: 'Platform name, default language, timezone, and other general configuration settings.',
    icon: Settings,
    items: ['Platform Name', 'Default Language', 'Default Timezone', 'Maintenance Mode', 'Registration Open'],
  },
  {
    id: 'security',
    title: 'Security',
    description: 'Password policies, session management, IP allowlists, and authentication settings.',
    icon: Shield,
    items: ['Password Minimum Length', 'Password Complexity Rules', 'Session Timeout', 'Max Login Attempts', 'IP Allowlist', 'CORS Origins'],
  },
  {
    id: 'email',
    title: 'Email',
    description: 'SMTP configuration, email templates, and notification settings.',
    icon: Mail,
    items: ['SMTP Host', 'SMTP Port', 'From Address', 'Email Templates', 'Notification Preferences'],
  },
  {
    id: 'storage',
    title: 'Storage',
    description: 'File storage configuration, upload limits, and storage quotas.',
    icon: HardDrive,
    items: ['Storage Provider', 'Upload Max Size', 'Allowed File Types', 'Storage Quota', 'CDN Configuration'],
  },
]

export default function PlatformSettings() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Platform Settings</h1>
        <p className='text-muted-foreground mt-1'>Configure global platform settings and preferences</p>
      </div>

      <div className='space-y-4'>
        {settingSections.map((section) => {
          const Icon = section.icon
          return (
            <Card key={section.id}>
              <CardHeader>
                <div className='flex items-start gap-3'>
                  <div className='rounded-lg bg-muted p-2 shrink-0'>
                    <Icon className='size-4 text-muted-foreground' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-center gap-2'>
                      <CardTitle className='text-base'>{section.title}</CardTitle>
                      <Badge variant='outline' className='text-[10px] px-1.5'>Phase 2</Badge>
                    </div>
                    <CardDescription className='mt-1'>{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className='rounded-md border divide-y'>
                  {section.items.map((item) => (
                    <div
                      key={item}
                      className='flex items-center justify-between px-4 py-3'
                    >
                      <span className='text-sm'>{item}</span>
                      <span className='text-xs text-muted-foreground'>Configure in Phase 2</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className='border-dashed'>
        <CardContent className='flex items-center gap-3 py-6'>
          <Wrench className='size-5 text-muted-foreground shrink-0' />
          <div>
            <p className='text-sm font-medium text-muted-foreground'>Settings Coming Soon</p>
            <p className='text-xs text-muted-foreground mt-0.5'>
              Platform settings will be configurable in Phase 2. Settings will be persisted to the database and applied globally across all tenants.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
