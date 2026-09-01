'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  ExternalLink,
  Info,
  AlertTriangle,
  ShieldCheck,
  Megaphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

// ============================================
// Types
// ============================================

interface Notification {
  id: string
  userId: string
  title: string
  body: string
  type: string
  link: string | null
  read: boolean
  createdAt: string
}

interface NotificationsResponse {
  success: boolean
  data: Notification[]
}

// ============================================
// Constants
// ============================================

const TYPE_ICONS: Record<string, React.ReactNode> = {
  INFO: <Info className='size-4' />,
  WARNING: <AlertTriangle className='size-4' />,
  ERROR: <AlertCircle className='size-4' />,
  SUCCESS: <ShieldCheck className='size-4' />,
  ALERT: <AlertCircle className='size-4' />,
  MARKETING: <Megaphone className='size-4' />,
}

const TYPE_STYLES: Record<string, string> = {
  INFO: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  WARNING: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  ERROR: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  SUCCESS: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  ALERT: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  MARKETING: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
}

// ============================================
// Helpers
// ============================================

function formatNotifTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

// ============================================
// Skeletons
// ============================================

function NotificationSkeleton() {
  return (
    <div className='flex items-start gap-3 px-4 py-3'>
      <Skeleton className='size-8 rounded-lg' />
      <div className='flex-1 space-y-2'>
        <Skeleton className='h-4 w-48' />
        <Skeleton className='h-3 w-64' />
      </div>
      <Skeleton className='h-3 w-14' />
    </div>
  )
}

// ============================================
// Notification Item
// ============================================

function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: Notification
  onMarkRead: (id: string) => void
  onDelete: (id: string) => void
}) {
  const router = useRouter()
  const type = notification.type || 'INFO'

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id)
    }
    if (notification.link) {
      router.push(notification.link)
    }
  }

  return (
    <div
      className={cn(
        'group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50',
        !notification.read && 'bg-primary/5'
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
          TYPE_STYLES[type] || TYPE_STYLES.INFO
        )}
      >
        {TYPE_ICONS[type] || TYPE_ICONS.INFO}
      </div>
      <button
        onClick={handleClick}
        className='min-w-0 flex-1 text-left'
      >
        <div className='flex items-center gap-2'>
          <p
            className={cn(
              'truncate text-sm',
              !notification.read ? 'font-semibold' : 'font-medium text-muted-foreground'
            )}
          >
            {notification.title}
          </p>
          {!notification.read && (
            <span className='size-2 shrink-0 rounded-full bg-primary' />
          )}
        </div>
        <p className='mt-0.5 line-clamp-2 text-xs text-muted-foreground'>
          {notification.body}
        </p>
        <p className='mt-1 text-[11px] text-muted-foreground'>
          {formatNotifTime(notification.createdAt)}
        </p>
      </button>
      <div className='flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100'>
        {notification.link && (
          <Button
            variant='ghost'
            size='icon'
            className='size-7'
            onClick={(e) => {
              e.stopPropagation()
              if (!notification.read) onMarkRead(notification.id)
              if (notification.link) router.push(notification.link)
            }}
            aria-label='Open link'
          >
            <ExternalLink className='size-3' />
          </Button>
        )}
        {!notification.read && (
          <Button
            variant='ghost'
            size='icon'
            className='size-7'
            onClick={(e) => {
              e.stopPropagation()
              onMarkRead(notification.id)
            }}
            aria-label='Mark as read'
          >
            <CheckCheck className='size-3' />
          </Button>
        )}
        <Button
          variant='ghost'
          size='icon'
          className='size-7 text-destructive hover:text-destructive'
          onClick={(e) => {
            e.stopPropagation()
            onDelete(notification.id)
          }}
          aria-label='Delete notification'
        >
          <Trash2 className='size-3' />
        </Button>
      </div>
    </div>
  )
}

// ============================================
// Main Page
// ============================================

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dbUnavailable, setDbUnavailable] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [markingAll, setMarkingAll] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setDbUnavailable(false)
      const params = new URLSearchParams()
      if (filter === 'unread') params.set('unread', 'true')
      const res = await apiFetch<NotificationsResponse>(
        `/api/v1/communication/notifications?${params}`
      )
      setNotifications(res.data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load notifications'
      if (msg.includes('Database unavailable') || msg.includes('503')) {
        setDbUnavailable(true)
        setError('Database is currently unavailable. Please try again later.')
      } else {
        setError(msg)
      }
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markAsRead = async (id: string) => {
    try {
      await apiFetch(`/api/v1/communication/notifications/${id}/read`, {
        method: 'POST',
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to mark as read'
      toast.error(msg)
    }
  }

  const requestDelete = (id: string) => {
    setPendingDeleteId(id)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    setShowDeleteConfirm(false)
    await deleteNotification(pendingDeleteId)
    setPendingDeleteId(null)
  }

  const deleteNotification = async (id: string) => {
    try {
      await apiFetch(`/api/v1/communication/notifications/${id}`, {
        method: 'DELETE',
      })
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      toast.success('Notification deleted')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete'
      toast.error(msg)
    }
  }

  const markAllAsRead = async () => {
    try {
      setMarkingAll(true)
      await apiFetch('/api/v1/communication/notifications/mark-all-read', {
        method: 'POST',
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      toast.success('All notifications marked as read')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to mark all as read'
      toast.error(msg)
    } finally {
      setMarkingAll(false)
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  // ---- DB Unavailable State ----
  if (dbUnavailable && !notifications.length) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Notifications</h1>
          <p className='mt-1 text-muted-foreground'>In-app notifications</p>
        </div>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertCircle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>Service Temporarily Unavailable</p>
            <p className='text-xs text-muted-foreground'>
              The database is not responding. This is usually a temporary issue.
            </p>
            <button
              onClick={fetchNotifications}
              className='mt-2 text-sm text-primary underline-offset-4 hover:underline'
            >
              Try again
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Notifications</h1>
          <p className='mt-1 text-muted-foreground'>In-app notifications</p>
        </div>
        <div className='flex items-center gap-3'>
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as 'all' | 'unread')}
          >
            <SelectTrigger className='w-[130px]' aria-label='Filter notifications'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All</SelectItem>
              <SelectItem value='unread'>Unread</SelectItem>
            </SelectContent>
          </Select>
          {unreadCount > 0 && (
            <Button
              variant='outline'
              size='sm'
              onClick={markAllAsRead}
              disabled={markingAll}
            >
              <CheckCheck className='size-4' />
              {markingAll ? 'Marking...' : 'Mark all read'}
            </Button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && !dbUnavailable && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-4'>
            <AlertCircle className='size-5 shrink-0 text-destructive' />
            <p className='flex-1 text-sm text-destructive'>{error}</p>
            <Button variant='outline' size='sm' onClick={fetchNotifications}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Notification List */}
      <Card>
        <CardContent className='p-0'>
          {loading ? (
            <div className='divide-y'>
              {Array.from({ length: 6 }).map((_, i) => (
                <NotificationSkeleton key={i} />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <BellOff className='mb-3 size-10 text-muted-foreground/40' />
              <p className='text-sm font-medium text-muted-foreground'>No notifications</p>
              <p className='mt-1 text-xs text-muted-foreground'>
                {filter === 'unread'
                  ? 'You are all caught up!'
                  : 'Notifications will appear here when available.'}
              </p>
            </div>
          ) : (
            <div className='divide-y'>
              {notifications.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onMarkRead={markAsRead}
                  onDelete={requestDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notification</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className='bg-destructive text-destructive-foreground'>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Count */}
      {!loading && notifications.length > 0 && (
        <p className='text-xs text-muted-foreground'>
          {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          {unreadCount > 0 && ` · ${unreadCount} unread`}
        </p>
      )}
    </div>
  )
}
