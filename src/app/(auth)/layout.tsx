import { ThemeToggle } from '@/components/app-shell/theme-toggle'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className='flex min-h-svh flex-col items-center justify-center bg-background p-4 sm:p-8'>
      {/* Top-right theme toggle */}
      <div className='fixed top-4 right-4 z-50'>
        <ThemeToggle />
      </div>

      {/* Branding + Card */}
      <div className='flex w-full max-w-md flex-col items-center gap-6'>
        <div className='flex flex-col items-center gap-2'>
          <div className='flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-lg font-bold'>
            HS
          </div>
          <h1 className='text-2xl font-bold tracking-tight'>HubSphere</h1>
          <p className='text-sm text-muted-foreground'>
            AI-Powered Business Operating System
          </p>
        </div>

        {children}
      </div>
    </div>
  )
}
