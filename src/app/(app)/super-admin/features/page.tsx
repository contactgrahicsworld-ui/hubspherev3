'use client'

import { Card, CardContent } from '@/components/ui/card'
import { ToggleLeft } from 'lucide-react'

export default function FeatureFlags() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Feature Flags</h1>
        <p className='text-muted-foreground mt-1'>
          Control platform features and capabilities
        </p>
      </div>

      <Card>
        <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
          <ToggleLeft className='size-10 text-muted-foreground/50 mb-3' />
          <p className='text-sm font-medium text-muted-foreground'>Feature flags management</p>
          <p className='text-xs text-muted-foreground mt-1'>
            Feature flag configuration will be available in a future update. Contact your system administrator for custom feature access.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
