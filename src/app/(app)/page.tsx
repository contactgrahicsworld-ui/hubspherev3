'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUserInfo } from '@/lib/auth-client'

export default function AppPage() {
  const router = useRouter()

  useEffect(() => {
    const info = getUserInfo()
    if (info?.role === 'SUPER_ADMIN') {
      router.replace('/super-admin')
    } else {
      router.replace('/admin')
    }
  }, [router])

  return null
}
