'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { AppSidebar } from '@/components/app-shell/app-sidebar'
import { AppHeader } from '@/components/app-shell/app-header'
import { BottomNav } from '@/components/app-shell/bottom-nav'
import { isAuthenticated, getUserInfo } from '@/lib/auth-client'

function AppShellSkeleton() {
  return (
    <div className='flex h-svh w-full'>
      {/* Sidebar skeleton */}
      <div className='hidden w-16 shrink-0 border-r border-border p-2 md:block'>
        <Skeleton className='mb-4 size-10 rounded-lg' />
        <div className='flex flex-col gap-2'>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className='size-8 rounded-md' />
          ))}
        </div>
      </div>

      {/* Main content skeleton */}
      <div className='flex flex-1 flex-col'>
        <div className='flex h-14 items-center gap-2 border-b border-border px-4'>
          <Skeleton className='size-7 rounded-md' />
          <Skeleton className='h-4 w-40 rounded' />
          <div className='ml-auto flex gap-1'>
            <Skeleton className='size-9 rounded-md' />
            <Skeleton className='size-9 rounded-md' />
          </div>
        </div>
        <div className='flex-1 p-4 md:p-6'>
          <Skeleton className='mb-4 h-8 w-48 rounded' />
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className='h-32 rounded-lg' />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [ready, setReady] = useState(() => isAuthenticated())
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const userRole = getUserInfo()?.role || 'VIEWER'

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
    }
  }, [router])

  const handleMobileNavOpen = useCallback(() => {
    setMobileNavOpen(true)
  }, [])

  if (!ready) {
    return <AppShellSkeleton />
  }

  return (
    <SidebarProvider>
      <AppSidebar userRole={userRole} />
      <SidebarInset>
        <AppHeader
          userRole={userRole}
          onMobileNavOpen={handleMobileNavOpen}
          mobileNavOpen={mobileNavOpen}
          onMobileNavChange={setMobileNavOpen}
        />
        <main className='flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6'>
          {children}
        </main>
      </SidebarInset>
      <BottomNav userRole={userRole} />
    </SidebarProvider>
  )
}
