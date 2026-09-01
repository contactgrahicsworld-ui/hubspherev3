import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function RootNotFound() {
  return (
    <div className='flex min-h-screen items-center justify-center bg-background p-4'>
      <div className='flex flex-col items-center gap-4 text-center'>
        <div className='flex size-16 items-center justify-center rounded-full bg-muted'>
          <FileQuestion className='size-8 text-muted-foreground' />
        </div>
        <h1 className='text-2xl font-bold'>404</h1>
        <p className='text-sm text-muted-foreground'>Page not found</p>
        <Button asChild>
          <Link href='/login'>Go to Login</Link>
        </Button>
      </div>
    </div>
  )
}
