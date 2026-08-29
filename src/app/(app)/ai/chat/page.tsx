'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/auth-client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Send,
  Bot,
  User,
  AlertTriangle,
  Sparkles,
  Brain,
  Phone,
  TrendingUp,
  Users,
  BarChart3,
  Settings,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface AgentInfo {
  id: string
  name: string
  status: 'ACTIVE' | 'INACTIVE' | 'NOT_CONFIGURED'
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  isAISuggestion?: boolean
}

// ============================================
// Constants
// ============================================

const ALL_AGENTS = ['NOVA', 'VOX', 'SALESPRO', 'PEOPLEMIND', 'INSIGHT'] as const

const AGENT_ICONS: Record<string, React.ReactNode> = {
  NOVA: <Brain className='size-4' />,
  VOX: <Phone className='size-4' />,
  SALESPRO: <TrendingUp className='size-4' />,
  PEOPLEMIND: <Users className='size-4' />,
  INSIGHT: <BarChart3 className='size-4' />,
}

const AGENT_LABELS: Record<string, string> = {
  NOVA: 'NOVA',
  VOX: 'VOX',
  SALESPRO: 'SALESPRO',
  PEOPLEMIND: 'PEOPLEMIND',
  INSIGHT: 'INSIGHT',
}

// ============================================
// Main Page
// ============================================

export default function AIChatPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [activeAgent, setActiveAgent] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch<{ success: boolean; data: { agents: AgentInfo[] } }>(
        '/api/v1/ai/agents'
      )
      const agentList = res.data.agents ?? []
      setAgents(agentList)

      const paramAgent = searchParams.get('agent')
      if (paramAgent) {
        setActiveAgent(paramAgent.toUpperCase())
      } else if (agentList.length > 0) {
        const firstActive = agentList.find((a) => a.status === 'ACTIVE')
        setActiveAgent(firstActive ? firstActive.id : agentList[0].id)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load AI agents'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [searchParams])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const currentAgentInfo = agents.find(
    (a) => a.id.toUpperCase() === activeAgent.toUpperCase()
  )
  const isNotConfigured = currentAgentInfo?.status === 'NOT_CONFIGURED'

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || sending || !activeAgent || isNotConfigured) return

    const userMessage: ChatMessage = { role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSending(true)

    try {
      const res = await apiFetch<{
        success: boolean
        data: { response: string; isAISuggestion?: boolean }
      }>('/api/v1/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          agent: activeAgent,
          message: trimmed,
        }),
      })

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: res.data.response,
        isAISuggestion: res.data.isAISuggestion ?? false,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get response'
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: `Error: ${message}`,
      }
      setMessages((prev) => [...prev, errMsg])
      toast.error(message)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }, [input, sending, activeAgent, isNotConfigured])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAgentChange = (agentId: string) => {
    setActiveAgent(agentId.toUpperCase())
    setMessages([])
    router.replace(`/ai/chat?agent=${agentId.toUpperCase()}`)
  }

  // ---- Loading State ----
  if (loading) {
    return (
      <div className='flex h-[calc(100vh-8rem)] flex-col gap-4'>
        <div className='flex items-center gap-3'>
          <Skeleton className='h-8 w-32' />
          <Skeleton className='h-8 w-32' />
        </div>
        <Card className='flex flex-1 flex-col overflow-hidden'>
          <CardContent className='flex-1 space-y-4 p-4'>
            <div className='flex justify-start gap-3'>
              <Skeleton className='size-8 rounded-full' />
              <Skeleton className='h-16 w-64 rounded-lg' />
            </div>
            <div className='flex justify-end gap-3'>
              <Skeleton className='h-10 w-48 rounded-lg' />
              <Skeleton className='size-8 rounded-full' />
            </div>
            <div className='flex justify-start gap-3'>
              <Skeleton className='size-8 rounded-full' />
              <Skeleton className='h-20 w-72 rounded-lg' />
            </div>
          </CardContent>
        </Card>
        <div className='flex gap-2'>
          <Skeleton className='h-10 flex-1 rounded-lg' />
          <Skeleton className='size-10 rounded-lg' />
        </div>
      </div>
    )
  }

  // ---- Error State ----
  if (error) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>AI Chat</h1>
          <p className='text-muted-foreground mt-1'>Chat with your AI assistants</p>
        </div>
        <Card className='border-destructive/50'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
            <AlertTriangle className='size-10 text-destructive' />
            <p className='text-sm font-medium text-destructive'>{error}</p>
            <button
              onClick={fetchAgents}
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
    <div className='flex h-[calc(100vh-8rem)] flex-col gap-3'>
      {/* Agent Selector */}
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <h1 className='text-lg font-bold tracking-tight sm:text-xl'>AI Chat</h1>
        {/* Desktop Tabs */}
        <div className='hidden sm:block'>
          <Tabs value={activeAgent} onValueChange={handleAgentChange}>
            <TabsList>
              {ALL_AGENTS.map((agent) => (
                <TabsTrigger key={agent} value={agent} className='gap-1.5 text-xs'>
                  {AGENT_ICONS[agent]}
                  {AGENT_LABELS[agent]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        {/* Mobile Select */}
        <div className='sm:hidden'>
          <Select value={activeAgent} onValueChange={handleAgentChange}>
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='Select agent' />
            </SelectTrigger>
            <SelectContent>
              {ALL_AGENTS.map((agent) => (
                <SelectItem key={agent} value={agent}>
                  <span className='flex items-center gap-2'>
                    {AGENT_ICONS[agent]}
                    {AGENT_LABELS[agent]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Not Configured State */}
      {isNotConfigured && (
        <Card className='border-amber-500/50 bg-amber-50 dark:bg-amber-950/20'>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-10 text-center'>
            <Settings className='size-10 text-amber-500' />
            <p className='text-sm font-semibold text-amber-700 dark:text-amber-400'>
              AI_NOT_CONFIGURED
            </p>
            <p className='max-w-sm text-xs text-muted-foreground'>
              The AI provider for <strong>{activeAgent}</strong> has not been configured.
              Please contact your administrator to set up the AI provider and API keys.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Chat Messages */}
      <Card className='flex flex-1 flex-col overflow-hidden'>
        <CardContent className='flex-1 p-0'>
          <ScrollArea className='h-full' ref={scrollRef}>
            <div className='flex flex-col gap-4 p-4'>
              {messages.length === 0 && !isNotConfigured && (
                <div className='flex flex-1 flex-col items-center justify-center py-16 text-center'>
                  <Bot className='mb-3 size-12 text-muted-foreground/30' />
                  <p className='text-sm font-medium text-muted-foreground'>
                    Chat with {AGENT_LABELS[activeAgent] || activeAgent}
                  </p>
                  <p className='mt-1 max-w-xs text-xs text-muted-foreground'>
                    Type a message below to start a conversation.
                  </p>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {msg.role === 'user' ? <User className='size-4' /> : <Bot className='size-4' />}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {msg.content}
                    {msg.role === 'assistant' && msg.isAISuggestion && (
                      <Badge
                        variant='outline'
                        className='mt-2 gap-1 border-primary/30 bg-primary/5 text-[10px] text-primary'
                      >
                        <Sparkles className='size-3' />
                        AI_SUGGESTION
                      </Badge>
                    )}
                  </div>
                </div>
              ))}

              {sending && (
                <div className='flex gap-3'>
                  <div className='flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground'>
                    <Bot className='size-4 animate-pulse' />
                  </div>
                  <div className='rounded-lg bg-muted px-3 py-2'>
                    <div className='flex gap-1'>
                      <span className='size-1.5 animate-bounce rounded-full bg-muted-foreground/50' style={{ animationDelay: '0ms' }} />
                      <span className='size-1.5 animate-bounce rounded-full bg-muted-foreground/50' style={{ animationDelay: '150ms' }} />
                      <span className='size-1.5 animate-bounce rounded-full bg-muted-foreground/50' style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Input Area */}
      <div className='flex gap-2'>
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isNotConfigured ? 'Configure AI provider to start chatting...' : `Message ${AGENT_LABELS[activeAgent] || activeAgent}...`}
          disabled={sending || isNotConfigured || !activeAgent}
          className='flex-1'
        />
        <Button
          onClick={handleSend}
          disabled={sending || !input.trim() || isNotConfigured || !activeAgent}
          size='icon'
          className='shrink-0'
        >
          <Send className='size-4' />
        </Button>
      </div>
    </div>
  )
}
