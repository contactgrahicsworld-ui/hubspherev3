'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { getNavForRole } from './nav-config'
import type { NavSection } from './nav-config'

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userRole: string
}

function NavSectionItems({ section, onClose }: { section: NavSection; onClose: () => void }) {
  const pathname = usePathname()

  return (
    <div className='flex flex-col gap-1'>
      <p className='px-3 py-2 text-xs font-medium text-muted-foreground'>
        {section.label}
      </p>
      {section.items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => window.innerWidth < 768 && onClose()}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors min-h-[44px] ${
              isActive
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <item.icon className='size-4 shrink-0' />
            <span>{item.title}</span>
          </Link>
        )
      })}
    </div>
  )
}

export function MobileNav({ open, onOpenChange, userRole }: MobileNavProps) {
  const sections = getNavForRole(userRole)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='left' className='w-72 p-0 [&>button]:hidden'>
        <SheetHeader className='border-b border-border px-4 py-4'>
          <SheetTitle className='flex items-center gap-2'>
            <div className='flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold'>
              HS
            </div>
            <div className='text-left'>
              <p className='font-semibold'>HubSphere</p>
              <p className='text-xs text-muted-foreground'>Business OS</p>
            </div>
          </SheetTitle>
        </SheetHeader>
        <nav className='flex flex-col gap-2 overflow-y-auto p-3' aria-label='Mobile navigation'>
          {sections.map((section, idx) => (
            <div key={section.label}>
              <NavSectionItems section={section} onClose={() => onOpenChange(false)} />
              {idx < sections.length - 1 && <Separator className='my-2' />}
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
