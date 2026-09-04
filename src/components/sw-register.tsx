'use client'

import { useEffect, useRef } from 'react'

export function ServiceWorkerRegistration() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('SW registered:', registration.scope)
          }

          // Check for updates periodically
          intervalRef.current = setInterval(() => {
            registration.update()
          }, 60 * 60 * 1000) // Every hour
        })
        .catch((error) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('SW registration failed:', error)
          }
        })

      // Listen for network status
      const handleOnline = () => {
        if (process.env.NODE_ENV === 'development') {
          console.log('Network: online')
        }
      }
      const handleOffline = () => {
        if (process.env.NODE_ENV === 'development') {
          console.log('Network: offline')
        }
      }

      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  return null
}
