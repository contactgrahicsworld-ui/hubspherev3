'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  AlertCircle,
  Send,
  ArrowLeft,
  MessageSquare,
  Mail,
  Smartphone,
  Bell,
  StickyNote,
  Filter,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================
// Types
// ============================================

interface Conversation {
  id: string
  participantName: string
  participantAvatar: string | null
  channel: string
  status: string
  lastMessage: string | null
  lastMessageAt: string | null
  unreadCount: number
}

interface Message {
  id: string
  conversationId: string
  direction: 'INBOUND' | 'OUTBOUND'
  content: string
  contentType: string
  senderName: string | null
  isInternal: boolean
  status: string | null
  createdAt: string
}

interface PaginatedConversations {
  success: boolean
  data: Conversation[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface PaginatedMessages {
  success: boolean
  data: Message[]
}

// ============================================
// Constants
// ============================================

const CHANNEL_TABS = [
  { value: '', label: 'All' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'IN_APP', label: 'In-App' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'ARCHIVED', label: 'Archived' },
]

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  WHATSAPP: <MessageSquare className='size-3.5' />,
  EMAIL: <Mail className='size-3.5' />,
  SMS: <Smartphone className='size-3.5' />,
  IN_APP: <Bell className='size-3.5' />,
}

const CHANNEL_BADGE_STYLES: Record<string, string> = {
  WHATSAPP: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  EMAIL: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  SMS: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  IN_APP: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
}

const MESSAGE_STATUS_STYLES: Record<string, string> = {
  SENT: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  DELIVERED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  READ: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

// ============================================
// Helpers
// ============================================

function formatMessageTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return ''
  }
}

function formatListItemTime(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Now'
    if (diffMin < 60) return `${diffMin}m`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay}d`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

// ============================================
// Skeletons
// ============================================

function ConversationListSkeleton() {
  return (
    <div className='divide-y'>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className='flex items-center gap-3 p-3'>
          <Skeleton className='size-10 rounded-full' />
          <div className='flex-1 space-y-2'>
            <Skeleton className='h-4 w-28' />
            <Skeleton className='h-3 w-44' />
          </div>
          <Skeleton className='h-3 w-10' />
        </div>
      ))}
    </div>
  )
}

function MessageThreadSkeleton() {
  return (
    <div className='space-y-4 p-4'>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={cn('flex gap-2', i % 2 === 0 ? 'justify-start' : 'justify-end')}
        >
          <Skeleton className='h-16 w-48 rounded-2xl' />
        </div>
      ))}
    </div>
  )
}

// ============================================
// Conversation List Item
// ============================================

function ConversationListItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50',
        isActive && 'bg-muted'
      )}
    >
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full text-white text-sm font-semibold',
          CHANNEL_BADGE_STYLES[conversation.channel]?.replace(/text-\S+/g, '') || 'bg-muted'
        )}
        style={{
          backgroundColor:
            conversation.channel === 'WHATSAPP'
              ? '#25D366'
              : conversation.channel === 'EMAIL'
                ? '#0EA5E9'
                : conversation.channel === 'SMS'
                  ? '#F59E0B'
                  : '#8B5CF6',
        }}
      >
        {(conversation.participantName || '?')[0].toUpperCase()}
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex items-center justify-between gap-2'>
          <span className='truncate text-sm font-medium'>
            {conversation.participantName || 'Unknown'}
          </span>
          <span className='shrink-0 text-[11px] text-muted-foreground'>
            {formatListItemTime(conversation.lastMessageAt)}
          </span>
        </div>
        <div className='flex items-center justify-between gap-2'>
          <p className='truncate text-xs text-muted-foreground'>
            {conversation.lastMessage || 'No messages yet'}
          </p>
          <div className='flex shrink-0 items-center gap-1'>
            {conversation.unreadCount > 0 && (
              <span className='flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground'>
                {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ============================================
// Message Bubble
// ============================================

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === 'OUTBOUND'

  return (
    <div className={cn('flex gap-2', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm',
          isOutbound
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted',
          message.isInternal && 'border border-dashed border-amber-400 bg-amber-50 dark:bg-amber-950/30'
        )}
      >
        {message.isInternal && (
          <div className='mb-1 flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400'>
            <StickyNote className='size-2.5' />
            Internal Note
          </div>
        )}
        <p className='whitespace-pre-wrap break-words'>{message.content}</p>
        <div
          className={cn(
            'mt-1 flex items-center gap-1.5 text-[10px]',
            isOutbound ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}
        >
          <span>{formatMessageTime(message.createdAt)}</span>
          {isOutbound && message.status && (
            <Badge
              variant='outline'
              className={cn(
                'h-4 px-1.5 text-[9px] border-current/20',
                isOutbound && MESSAGE_STATUS_STYLES[message.status]
              )}
            >
              {message.status}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Main Page
// ============================================

export default function InboxPage() {
  // Conversations list state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dbUnavailable, setDbUnavailable] = useState(false)

  // Filters
  const [channelTab, setChannelTab] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  // Selected conversation
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)

  // Composer
  const [composerText, setComposerText] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setDbUnavailable(false)

      const params = new URLSearchParams({ page: '1', limit: '50' })
      if (channelTab) params.set('channel', channelTab)
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)

      const res = await apiFetch<PaginatedConversations>(
        `/api/v1/communication/conversations?${params}`
      )
      setConversations(res.data)
      setTotal(res.pagination.total)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load conversations'
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
  }, [channelTab, statusFilter, search])

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (convId: string) => {
    try {
      setMessagesLoading(true)
      setMessagesError(null)
      const res = await apiFetch<PaginatedMessages>(
        `/api/v1/communication/conversations/${convId}/messages`
      )
      setMessages(res.data)
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load messages'
      setMessagesError(msg)
    } finally {
      setMessagesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Select a conversation
  const selectConversation = useCallback(
    (conv: Conversation) => {
      setSelectedId(conv.id)
      setSelectedConv(conv)
      fetchMessages(conv.id)
    },
    [fetchMessages]
  )

  // Send message
  const sendMessage = async () => {
    if (!selectedId || !composerText.trim() || sending) return
    try {
      setSending(true)
      await apiFetch(`/api/v1/communication/conversations/${selectedId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: composerText.trim(),
          contentType: 'TEXT',
          isInternal,
        }),
      })
      setComposerText('')
      setIsInternal(false)
      toast.success('Message sent')
      fetchMessages(selectedId)
      fetchConversations()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send message'
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Mobile: back from thread
  const [mobileShowThread, setMobileShowThread] = useState(false)

  const handleSelectConversation = (conv: Conversation) => {
    selectConversation(conv)
    setMobileShowThread(true)
  }

  // ---- Error State ----
  if (error && dbUnavailable && !conversations.length) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Inbox</h1>
          <p className='mt-1 text-muted-foreground'>Unified messaging inbox</p>
        </div>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertCircle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>Service Temporarily Unavailable</p>
            <p className='text-xs text-muted-foreground'>
              The database is not responding. This is usually a temporary issue.
            </p>
            <button
              onClick={fetchConversations}
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
    <div className='space-y-4'>
      {/* Header */}
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Inbox</h1>
        <p className='mt-1 text-muted-foreground'>Unified messaging inbox</p>
      </div>

      {/* Channel Tabs */}
      <div className='flex gap-1 overflow-x-auto rounded-lg border bg-muted/50 p-1'>
        {CHANNEL_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setChannelTab(tab.value)}
            className={cn(
              'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              channelTab === tab.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <div className='relative flex-1'>
          <Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Search conversations...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-9'
            aria-label='Search conversations'
          />
        </div>
        <div className='flex items-center gap-2'>
          <Filter className='size-4 text-muted-foreground sm:hidden' />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === '_all' ? '' : v)}>
            <SelectTrigger className='w-[160px]' aria-label='Filter by status'>
              <SelectValue placeholder='All Statuses' />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value || '_all'}
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error Banner (non-DB) */}
      {error && !dbUnavailable && (
        <Card className='border-destructive/50'>
          <CardContent className='flex items-center gap-3 py-4'>
            <AlertCircle className='size-5 shrink-0 text-destructive' />
            <p className='flex-1 text-sm text-destructive'>{error}</p>
            <Button
              variant='outline'
              size='sm'
              onClick={fetchConversations}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Three-Panel Layout */}
      <div className='flex gap-0 overflow-hidden rounded-lg border bg-background'>
        {/* Conversation List - hidden on mobile when thread is shown */}
        <div
          className={cn(
            'w-full shrink-0 border-r md:w-80 lg:w-96',
            mobileShowThread && 'hidden md:block'
          )}
        >
          {loading ? (
            <ConversationListSkeleton />
          ) : conversations.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <Inbox className='mb-3 size-10 text-muted-foreground/40' />
              <p className='text-sm font-medium text-muted-foreground'>
                No conversations yet
              </p>
              <p className='mt-1 text-xs text-muted-foreground'>
                {channelTab || statusFilter || search
                  ? 'Try adjusting your filters.'
                  : 'Start a conversation to see it here.'}
              </p>
            </div>
          ) : (
            <ScrollArea className='h-[calc(100vh-320px)]'>
              <div className='divide-y'>
                {conversations.map((conv) => (
                  <ConversationListItem
                    key={conv.id}
                    conversation={conv}
                    isActive={selectedId === conv.id}
                    onClick={() => handleSelectConversation(conv)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Message Thread - hidden on mobile until selection */}
        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col',
            !mobileShowThread && 'hidden md:flex'
          )}
        >
          {!selectedConv ? (
            <div className='flex flex-1 flex-col items-center justify-center py-16 text-center'>
              <MessageSquare className='mb-3 size-10 text-muted-foreground/40' />
              <p className='text-sm font-medium text-muted-foreground'>
                Select a conversation
              </p>
              <p className='mt-1 text-xs text-muted-foreground'>
                Choose a conversation from the list to view messages
              </p>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className='flex items-center gap-3 border-b px-4 py-3'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='md:hidden'
                  onClick={() => setMobileShowThread(false)}
                >
                  <ArrowLeft className='size-4' />
                </Button>
                <div className='flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground'>
                  {(selectedConv.participantName || '?')[0].toUpperCase()}
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium'>
                    {selectedConv.participantName || 'Unknown'}
                  </p>
                  <div className='flex items-center gap-2'>
                    <Badge
                      variant='outline'
                      className={`text-[10px] ${CHANNEL_BADGE_STYLES[selectedConv.channel] || ''}`}
                    >
                      {CHANNEL_ICONS[selectedConv.channel]}
                      <span className='ml-1'>{selectedConv.channel}</span>
                    </Badge>
                    <Badge variant='outline' className='text-[10px]'>
                      {selectedConv.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className='flex-1 overflow-y-auto'>
                {messagesLoading ? (
                  <MessageThreadSkeleton />
                ) : messagesError ? (
                  <div className='flex flex-col items-center justify-center py-12 text-center'>
                    <AlertCircle className='mb-2 size-8 text-destructive' />
                    <p className='text-sm text-destructive'>{messagesError}</p>
                    <Button
                      variant='outline'
                      size='sm'
                      className='mt-3'
                      onClick={() => fetchMessages(selectedConv.id)}
                    >
                      Retry
                    </Button>
                  </div>
                ) : messages.length === 0 ? (
                  <div className='flex flex-col items-center justify-center py-12 text-center'>
                    <MessageSquare className='mb-2 size-8 text-muted-foreground/40' />
                    <p className='text-sm text-muted-foreground'>No messages yet</p>
                  </div>
                ) : (
                  <div className='space-y-3 p-4'>
                    {messages.map((msg) => (
                      <MessageBubble key={msg.id} message={msg} />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Composer */}
              <div className='border-t p-3'>
                <div className='flex items-start gap-2'>
                  <div className='flex-1 space-y-2'>
                    <Textarea
                      placeholder='Type a message...'
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={2}
                      className='resize-none'
                      aria-label='Message composer'
                    />
                    <div className='flex items-center gap-3'>
                      <div className='flex items-center gap-1.5'>
                        <Checkbox
                          id='internal-note'
                          checked={isInternal}
                          onCheckedChange={(v) => setIsInternal(!!v)}
                        />
                        <label
                          htmlFor='internal-note'
                          className='flex cursor-pointer items-center gap-1 text-xs text-muted-foreground'
                        >
                          <StickyNote className='size-3' />
                          Internal note
                        </label>
                      </div>
                      <Badge
                        variant='outline'
                        className={`text-[10px] ${CHANNEL_BADGE_STYLES[selectedConv.channel] || ''}`}
                      >
                        {selectedConv.channel}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size='icon'
                    onClick={sendMessage}
                    disabled={!composerText.trim() || sending}
                    className='mt-1 shrink-0'
                    aria-label='Send message'
                  >
                    <Send className='size-4' />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Count footer */}
      {!loading && conversations.length > 0 && (
        <p className='text-xs text-muted-foreground'>
          Showing {conversations.length} of {total} conversations
        </p>
      )}
    </div>
  )
}
