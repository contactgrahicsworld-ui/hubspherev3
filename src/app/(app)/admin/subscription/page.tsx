import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Crown, Zap, Rocket, Building2 } from 'lucide-react'

interface Plan {
  name: string
  code: string
  price: string
  period: string
  description: string
  features: string[]
  highlighted: boolean
  current: boolean
}

const plans: Plan[] = [
  {
    name: 'Free',
    code: 'FREE',
    price: '$0',
    period: 'forever',
    description: 'For small teams just getting started',
    features: [
      'Up to 5 members',
      'Basic roles',
      'Audit logs (7 days)',
      'Community support',
    ],
    highlighted: false,
    current: true,
  },
  {
    name: 'Starter',
    code: 'STARTER',
    price: '$29',
    period: '/month',
    description: 'For growing teams that need more',
    features: [
      'Up to 25 members',
      'Custom roles',
      'Audit logs (90 days)',
      'Email support',
      'SSO integration',
    ],
    highlighted: false,
    current: false,
  },
  {
    name: 'Pro',
    code: 'PRO',
    price: '$79',
    period: '/month',
    description: 'For organizations that need full control',
    features: [
      'Up to 100 members',
      'Custom roles & permissions',
      'Unlimited audit logs',
      'Priority support',
      'SSO & SAML',
      'API access',
    ],
    highlighted: true,
    current: false,
  },
  {
    name: 'Enterprise',
    code: 'ENTERPRISE',
    price: 'Custom',
    period: '',
    description: 'For large organizations with custom needs',
    features: [
      'Unlimited members',
      'Advanced RBAC',
      'Unlimited audit logs',
      'Dedicated support',
      'SSO, SAML & SCIM',
      'API access',
      'SLA guarantee',
      'Custom integrations',
    ],
    highlighted: false,
    current: false,
  },
]

const planIcons: Record<string, React.ElementType> = {
  FREE: Crown,
  STARTER: Zap,
  PRO: Rocket,
  ENTERPRISE: Building2,
}

export default function AdminSubscriptionPage() {
  const currentPlan = plans.find((p) => p.current)

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='text-center sm:text-left'>
        <h1 className='text-2xl font-bold tracking-tight'>Subscription &amp; Plans</h1>
        <p className='text-muted-foreground mt-1'>
          Manage your organization&apos;s subscription plan
        </p>
      </div>

      {/* Current Plan Banner */}
      {currentPlan && (
        <Card className='border-primary/30 bg-primary/5'>
          <CardContent className='flex flex-col items-center gap-3 py-6 sm:flex-row sm:justify-between'>
            <div className='flex items-center gap-3'>
              {(() => {
                const Icon = planIcons[currentPlan.code] || Crown
                return (
                  <div className='flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                    <Icon className='size-5' />
                  </div>
                )
              })()}
              <div>
                <p className='font-medium'>Current Plan: {currentPlan.name}</p>
                <p className='text-sm text-muted-foreground'>{currentPlan.description}</p>
              </div>
            </div>
            <Badge variant='default'>Active</Badge>
          </CardContent>
        </Card>
      )}

      {/* Plan Cards */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {plans.map((plan) => {
          const Icon = planIcons[plan.code] || Crown
          return (
            <Card
              key={plan.code}
              className={`relative flex flex-col ${plan.highlighted ? 'border-primary shadow-md' : ''}`}
            >
              {plan.highlighted && (
                <div className='absolute -top-3 left-1/2 -translate-x-1/2'>
                  <Badge className='bg-primary text-primary-foreground'>Most Popular</Badge>
                </div>
              )}
              <CardHeader className='text-center'>
                <div className='mx-auto flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                  <Icon className='size-5' />
                </div>
                <CardTitle className='text-lg'>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className='flex-1'>
                <div className='mb-4 text-center'>
                  <span className='text-3xl font-bold'>{plan.price}</span>
                  {plan.period && (
                    <span className='text-muted-foreground text-sm'>{plan.period}</span>
                  )}
                </div>
                <ul className='space-y-2' role='list'>
                  {plan.features.map((feature) => (
                    <li key={feature} className='flex items-start gap-2 text-sm'>
                      <Check className='mt-0.5 size-4 shrink-0 text-primary' aria-hidden='true' />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {plan.current ? (
                  <Button variant='outline' className='w-full' disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    variant={plan.highlighted ? 'default' : 'outline'}
                    className='w-full'
                    disabled
                    title='Upgrades coming in Phase 2'
                  >
                    Upgrade
                  </Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {/* Phase 2 Notice */}
      <p className='text-center text-xs text-muted-foreground'>
        Plan upgrades and billing management will be available in Phase 2.
      </p>
    </div>
  )
}
