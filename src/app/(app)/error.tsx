'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AppError]', error)
  }, [error])

  return (
    <div className='flex min-h-[60vh] items-center justify-center p-4'>
      <Card className='w-full max-w-md border-destructive/30'>
        <CardContent className='flex flex-col items-center gap-4 py-10 text-center'>
          <div className='flex size-14 items-center justify-center rounded-full bg-destructive/10'>
            <AlertTriangle className='size-7 text-destructive' />
          </div>
          <div className='space-y-1'>
            <h2 className='text-lg font-semibold'>Something went wrong</h2>
            <p className='text-sm text-muted-foreground'>
              An unexpected error occurred. Please try again or return to the dashboard.
            </p>
          </div>
          {error.digest && (
            <p className='text-xs text-muted-foreground/60'>Error ID: {error.digest}</p>
          )}
          <div className='flex gap-3'>
            <Button
              variant='outline'
              onClick={() => (window.location.href = '/')}
            >
              <Home className='mr-2 size-4' />
              Dashboard
            </Button>
            <Button onClick={reset}>
              <RefreshCw className='mr-2 size-4' />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
