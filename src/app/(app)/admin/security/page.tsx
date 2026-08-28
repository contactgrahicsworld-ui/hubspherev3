'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  KeyRound,
  ShieldCheck,
  Smartphone,
  Key,
} from 'lucide-react'

const securitySections = [
  {
    title: 'Password Policy',
    description:
      'Configure minimum password length, complexity requirements, and expiration policies for your organization.',
    icon: KeyRound,
  },
  {
    title: 'Session Management',
    description:
      'Control session duration, concurrent sessions, and automatic logout behavior for all members.',
    icon: Smartphone,
  },
  {
    title: 'Two-Factor Authentication',
    description:
      'Enforce or encourage two-factor authentication (2FA) for members to add an extra layer of security.',
    icon: ShieldCheck,
  },
  {
    title: 'API Keys',
    description:
      'Manage API keys for programmatic access. Create, rotate, and revoke keys for integrations.',
    icon: Key,
  },
]

export default function AdminSecurityPage() {
  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Security Settings</h1>
        <p className='text-muted-foreground mt-1'>
          Configure security policies for your organization
        </p>
      </div>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        {securitySections.map((section) => {
          const Icon = section.icon
          return (
            <Card key={section.title}>
              <CardHeader>
                <div className='flex items-start justify-between gap-2'>
                  <div className='flex items-center gap-3'>
                    <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                      <Icon className='size-5' />
                    </div>
                    <CardTitle className='text-base'>{section.title}</CardTitle>
                  </div>
                  <Badge variant='secondary'>Phase 2</Badge>
                </div>
                <CardDescription className='pl-[52px]'>
                  {section.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className='pl-[52px] text-sm text-muted-foreground'>
                  Configure in Phase 2
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
