'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'

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

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
})

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  async function onSubmit(values: ForgotPasswordValues) {
    setError(null)
    setIsLoading(true)

    try {
      await apiFetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      setIsSubmitted(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Forgot your password?</CardTitle>
        <CardDescription>
          {isSubmitted
            ? 'Check your email for further instructions'
            : 'Enter your email and we\'ll send you a reset link'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isSubmitted ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-primary/10 flex size-12 items-center justify-center rounded-full">
              <CheckCircle2 className="text-primary size-6" />
            </div>
            <Alert>
              <AlertDescription className="text-center">
                If an account exists with this email, a reset link has been created.
              </AlertDescription>
            </Alert>
          </div>
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                          <Input
                            type="email"
                            placeholder="you@company.com"
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

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Sending reset link...
                    </>
                  ) : (
                    'Send reset link'
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
          <ArrowLeft className="size-3.5" />
          Back to login
        </Button>
      </CardFooter>
    </Card>
  )
}
