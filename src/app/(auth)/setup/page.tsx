'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, UserPlus, Mail, Lock, User, ShieldCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { apiFetch, setTokens, setUserInfo } from '@/lib/auth-client'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

const setupSchema = z
  .object({
    name: z.string().min(1, 'Name is required').min(2, 'Name must be at least 2 characters'),
    email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type SetupValues = z.infer<typeof setupSchema>

interface SetupStatusResponse {
  setupComplete: boolean
}

interface SetupResponse {
  accessToken: string
  refreshToken: string
  user: {
    name: string
    email: string
    role: string
  }
}

export default function SetupPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)

  const form = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    async function checkSetupStatus() {
      try {
        const data = await apiFetch<SetupStatusResponse>('/api/v1/auth/setup/status')
        if (data.setupComplete) {
          toast.info('Setup already completed', {
            description: 'Redirecting to login...',
          })
          router.push('/login')
          return
        }
      } catch {
        // If the endpoint errors, assume setup is not complete yet
      } finally {
        setIsCheckingStatus(false)
      }
    }
    checkSetupStatus()
  }, [router])

  async function onSubmit(values: SetupValues) {
    setError(null)
    setIsLoading(true)

    try {
      const data = await apiFetch<SetupResponse>('/api/v1/auth/setup', {
        method: 'POST',
        body: JSON.stringify(values),
      })

      setTokens(data.accessToken, data.refreshToken)
      setUserInfo(data.user)

      toast.success('Super Admin account created!', {
        description: 'Welcome to HubSphere. Let\'s get you started.',
      })

      router.push('/super-admin')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Setup failed. Please try again.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isCheckingStatus) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="text-primary animate-spin size-6" />
            <p className="text-muted-foreground text-sm">Checking setup status...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <ShieldCheck className="text-primary size-7" />
        </div>
        <CardTitle className="text-2xl">Welcome to HubSphere</CardTitle>
        <CardDescription className="mt-1.5">
          Create your Super Admin account to get started
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                      <Input
                        type="text"
                        placeholder="John Doe"
                        autoComplete="name"
                        className="pl-9"
                        disabled={isLoading}
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                      <Input
                        type="email"
                        placeholder="admin@company.com"
                        autoComplete="email"
                        className="pl-9"
                        disabled={isLoading}
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                      <Input
                        type="password"
                        placeholder="Create a strong password"
                        autoComplete="new-password"
                        className="pl-9"
                        disabled={isLoading}
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                      <Input
                        type="password"
                        placeholder="Confirm your password"
                        autoComplete="new-password"
                        className="pl-9"
                        disabled={isLoading}
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Creating Super Admin...
                </>
              ) : (
                <>
                  <Sparkles />
                  Create Super Admin account
                </>
              )}
            </Button>

            <p className="text-muted-foreground text-center text-xs">
              This will be the primary administrator account with full system access.
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
