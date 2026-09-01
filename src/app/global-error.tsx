'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className='flex min-h-screen items-center justify-center bg-background p-4'>
          <div className='flex flex-col items-center gap-4 text-center'>
            <div className='flex size-16 items-center justify-center rounded-full bg-destructive/10'>
              <svg className='size-8 text-destructive' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
                <path strokeLinecap='round' strokeLinejoin='round' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z' />
              </svg>
            </div>
            <h2 className='text-xl font-semibold'>Application Error</h2>
            <p className='max-w-sm text-sm text-muted-foreground'>
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {error.digest && (
              <p className='text-xs text-muted-foreground/60'>Error ID: {error.digest}</p>
            )}
            <button
              onClick={reset}
              className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90'
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
