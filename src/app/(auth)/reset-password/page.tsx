'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Lock, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

import { apiFetch } from '@/lib/auth-client'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
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

const resetPasswordSchema = z
  .object({
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

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset link.')
    }
  }, [token])

  async function onSubmit(values: ResetPasswordValues) {
    if (!token) return

    setError(null)
    setIsLoading(true)

    try {
      const { confirmPassword: _, ...payload } = values
      await apiFetch('/api/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ ...payload, token }),
      })

      toast.success('Password reset successful', {
        description: 'You can now sign in with your new password.',
      })

      router.push('/login')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to reset password. Please try again.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const hasTokenError = !token

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 bg-primary/10 flex size-12 items-center justify-center rounded-full">
          <KeyRound className="text-primary size-6" />
        </div>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>
          Enter your new password below
        </CardDescription>
      </CardHeader>

      <CardContent>
        {hasTokenError ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                          <Input
                            type="password"
                            placeholder="Enter new password"
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
                      <FormLabel>Confirm new password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                          <Input
                            type="password"
                            placeholder="Confirm new password"
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

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isLoading || hasTokenError}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Resetting password...
                    </>
                  ) : (
                    'Reset password'
                  )}
                </Button>
              </form>
            </Form>
          </>
        )}
      </CardContent>

      <CardFooter className="justify-center">
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm"
          onClick={() => router.push('/login')}
        >
          Back to login
        </Button>
      </CardFooter>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <Card className="w-full">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground animate-spin size-6" />
          </CardContent>
        </Card>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
