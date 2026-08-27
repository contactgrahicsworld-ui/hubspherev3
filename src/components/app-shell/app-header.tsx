'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, LogOut, Menu, Settings, User } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from './theme-toggle'
import { MobileNav } from './mobile-nav'
import { useIsMobile } from '@/hooks/use-mobile'
import { getUserInfo, clearTokens, clearUserInfo } from '@/lib/auth-client'
import { useState, useCallback } from 'react'

function Breadcrumbs() {
  const pathname = usePathname()

  // Skip breadcrumbs for root dashboard pages
  if (pathname === '/super-admin' || pathname === '/admin') return null

  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbItems = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    const label = segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
    return { label, href }
  })

  if (breadcrumbItems.length === 0) return null

  return (
    <Breadcrumb className='hidden sm:flex'>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href='/'>Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {breadcrumbItems.map((item, index) => (
          <span key={item.href} className='contents'>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {index === breadcrumbItems.length - 1 ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

interface AppHeaderProps {
  userRole: string
  onMobileNavOpen: () => void
  mobileNavOpen: boolean
  onMobileNavChange: (open: boolean) => void
}

export function AppHeader({
  userRole,
  onMobileNavOpen,
  mobileNavOpen,
  onMobileNavChange,
}: AppHeaderProps) {
  const isMobile = useIsMobile()
  const router = useRouter()
  const userInfo = getUserInfo()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const initials = userInfo?.name
    ? userInfo.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U'

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' })
    } catch {
      // Ignore logout API errors
    } finally {
      clearTokens()
      clearUserInfo()
      router.push('/login')
    }
  }, [isLoggingOut, router])

  return (
    <>
      <header className='flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4 md:px-6'>
        {isMobile ? (
          <Button
            variant='ghost'
            size='icon'
            className='size-9'
            onClick={onMobileNavOpen}
            aria-label='Open navigation menu'
          >
            <Menu className='size-4' />
          </Button>
        ) : (
          <SidebarTrigger className='-ml-1' />
        )}

        <Separator orientation='vertical' className='mx-2 h-4' />

        <Breadcrumbs />

        <div className='ml-auto flex items-center gap-1'>
          <ThemeToggle />

          <Button
            variant='ghost'
            size='icon'
            className='size-9'
            aria-label='Notifications'
          >
            <Bell className='size-4' />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                className='relative h-9 gap-2 rounded-full pl-1 pr-3'
              >
                <Avatar className='size-7'>
                  <AvatarFallback className='text-xs'>{initials}</AvatarFallback>
                </Avatar>
                <span className='hidden text-sm font-medium sm:inline-block'>
                  {userInfo?.name || 'User'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-56'>
              <DropdownMenuLabel className='font-normal'>
                <div className='flex flex-col space-y-1'>
                  <p className='text-sm font-medium leading-none'>
                    {userInfo?.name || 'User'}
                  </p>
                  <p className='text-xs leading-none text-muted-foreground'>
                    {userInfo?.email || 'user@example.com'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <User className='mr-2 size-4' />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={
                    userRole === 'SUPER_ADMIN'
                      ? '/super-admin/settings'
                      : '/admin/settings'
                  }
                >
                  <Settings className='mr-2 size-4' />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={isLoggingOut}
                variant='destructive'
              >
                <LogOut className='mr-2 size-4' />
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <MobileNav
        open={mobileNavOpen}
        onOpenChange={onMobileNavChange}
        userRole={userRole}
      />
    </>
  )
}
