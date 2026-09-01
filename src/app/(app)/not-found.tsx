'use client'

import { FileQuestion, Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function AppNotFound() {
  return (
    <div className='flex min-h-[60vh] items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <CardContent className='flex flex-col items-center gap-4 py-10 text-center'>
          <div className='flex size-14 items-center justify-center rounded-full bg-muted'>
            <FileQuestion className='size-7 text-muted-foreground' />
          </div>
          <div className='space-y-1'>
            <h2 className='text-lg font-semibold'>Page Not Found</h2>
            <p className='text-sm text-muted-foreground'>
              The page you are looking for does not exist or has been moved.
            </p>
          </div>
          <div className='flex gap-3'>
            <Button
              variant='outline'
              onClick={() => window.history.back()}
            >
              <ArrowLeft className='mr-2 size-4' />
              Go Back
            </Button>
            <Button onClick={() => (window.location.href = '/')}>
              <Home className='mr-2 size-4' />
              Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
