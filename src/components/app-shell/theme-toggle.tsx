'use client'

import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  const getIcon = () => {
    if (theme === 'dark') return <Moon className='size-4' />
    if (theme === 'light') return <Sun className='size-4' />
    return <Monitor className='size-4' />
  }

  const getLabel = () => {
    if (theme === 'dark') return 'Dark mode'
    if (theme === 'light') return 'Light mode'
    return 'System theme'
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          onClick={cycleTheme}
          aria-label={getLabel()}
          className='size-9'
        >
          {getIcon()}
          <span className='sr-only'>Toggle theme</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{getLabel()}</TooltipContent>
    </Tooltip>
  )
}
