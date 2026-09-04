'use client'

import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode, Component, type ErrorInfo } from 'react'

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className='flex min-h-[400px] flex-col items-center justify-center gap-4 p-8'>
      <div className='rounded-full bg-destructive/10 p-4'>
        <svg className='size-8 text-destructive' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
          <path strokeLinecap='round' strokeLinejoin='round' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' />
        </svg>
      </div>
      <h2 className='text-lg font-semibold'>Something went wrong</h2>
      <p className='max-w-md text-center text-sm text-muted-foreground'>
        An unexpected error occurred. Please try refreshing the page.
      </p>
      <button
        onClick={resetErrorBoundary}
        className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90'
      >
        Try again
      </button>
    </div>
  )
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error via structured reporting in production
    if (process.env.NODE_ENV === 'development') {
      console.error('[HubSphere] Unhandled error:', error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error!}
          resetErrorBoundary={() => this.setState({ hasError: false, error: null })}
        />
      )
    }
    return this.props.children
  }
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute='class'
          defaultTheme='system'
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
