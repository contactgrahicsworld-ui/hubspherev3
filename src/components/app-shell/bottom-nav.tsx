'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Shield, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface BottomNavItem {
 title: string
  href: string
  icon: LucideIcon
}

function getBottomNavItems(userRole: string): BottomNavItem[] {
  if (userRole === 'SUPER_ADMIN') {
    return [
      { title: 'Dashboard', href: '/super-admin', icon: LayoutDashboard },
      { title: 'Tenants', href: '/super-admin/tenants', icon: Users },
      { title: 'Roles', href: '/super-admin/roles', icon: Shield },
      { title: 'Settings', href: '/super-admin/settings', icon: Settings },
    ]
  }
  return [
    { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { title: 'Users', href: '/admin/users', icon: Users },
    { title: 'Roles', href: '/admin/roles', icon: Shield },
    { title: 'Settings', href: '/admin/settings', icon: Settings },
  ]
}

interface BottomNavProps {
  userRole: string
}

export function BottomNav({ userRole }: BottomNavProps) {
  const pathname = usePathname()
  const items = getBottomNavItems(userRole)

  return (
    <nav
      className='fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background md:hidden'
      aria-label='Bottom navigation'
    >
      <div className='flex h-16 items-center justify-around px-2'>
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1 text-xs transition-colors',
                isActive
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon
                className={cn('size-5', isActive && 'text-primary')}
              />
              <span className='truncate'>{item.title}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
