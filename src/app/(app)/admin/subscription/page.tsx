'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/auth-client';

const PLANS = [
  {
    code: 'FREE',
    name: 'Free',
    price: 0,
    yearlyPrice: 0,
    maxUsers: 3,
    features: ['Basic CRM', '3 Users', '100MB Storage', '14-day trial'],
  },
  {
    code: 'STARTER',
    name: 'Starter',
    price: 29,
    yearlyPrice: 290,
    maxUsers: 10,
    features: ['CRM + HRMS', '10 Users', '1GB Storage', 'Communication', 'Analytics', 'Audit Log', 'File Uploads'],
    popular: true,
  },
  {
    code: 'PRO',
    name: 'Pro',
    price: 79,
    yearlyPrice: 790,
    maxUsers: 50,
    features: ['All Starter features', 'AI Agents', 'Automation', '50 Users', '10GB Storage', 'Custom Roles', 'API Access', 'Priority Support'],
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    price: 199,
    yearlyPrice: 1990,
    maxUsers: -1,
    features: ['All Pro features', 'Unlimited Users', 'Unlimited Storage', 'SSO', 'White Label', 'Dedicated Support'],
  },
];

interface BillingData {
  plan: string;
  planName: string;
  status: string;
  currentUsers: number;
  maxUsers: number;
  daysRemaining: number | null;
  isInTrial: boolean;
  isPastDue: boolean;
  isCancelled: boolean;
  canAddUsers: boolean;
}

export default function SubscriptionPage() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadBilling();
  }, []);

  async function loadBilling() {
    try {
      const data = await apiFetch<{ success: boolean; data: BillingData }>('/api/v1/billing/subscription');
      if (data.success) {
        setBilling(data.data);
      }
    } catch (e) {
      console.error('Failed to load billing:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePlan(planCode: string) {
    setChanging(planCode);
    setError(null);
    setSuccessMsg(null);

    try {
      const data = await apiFetch<{ success: boolean; data: { message?: string } }>('/api/v1/billing/subscription', {
        method: 'PUT',
        body: JSON.stringify({ plan: planCode }),
      });

      if (data.success) {
        setSuccessMsg(data.data?.message || `Plan changed to ${planCode}`);
        await loadBilling();
      } else {
        setError('Failed to change plan');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to change plan');
    } finally {
      setChanging(null);
    }
  }

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel your subscription? You will be downgraded to the Free plan.')) return;
    
    setChanging('cancel');
    setError(null);

    try {
      await apiFetch('/api/v1/billing/subscription', {
        method: 'DELETE',
      });
      setSuccessMsg('Subscription cancelled');
      await loadBilling();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setChanging(null);
    }
  }

  const currentPlan = billing?.plan || 'FREE';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription & Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your plan and billing</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">{successMsg}</div>
      )}

      {/* Current Plan Status */}
      {billing && (
        <div className="border rounded-lg p-6 bg-card">
          <h2 className="text-lg font-semibold mb-4">Current Plan</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="text-xl font-bold">{billing.planName || billing.plan}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="text-xl font-bold capitalize">{billing.status?.toLowerCase()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Users</p>
              <p className="text-xl font-bold">
                {billing.currentUsers} / {billing.maxUsers === Infinity ? '∞' : billing.maxUsers}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Days Remaining</p>
              <p className="text-xl font-bold">{billing.daysRemaining ?? '-'}</p>
            </div>
          </div>
          {billing.isInTrial && (
            <p className="mt-4 text-amber-600 text-sm">
              You are in a trial period. {billing.daysRemaining} days remaining.
            </p>
          )}
          {billing.isPastDue && (
            <p className="mt-4 text-red-600 text-sm">
              Your subscription is past due. Please update your payment method.
            </p>
          )}
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.code;
          const planIndex = PLANS.findIndex(p => p.code === plan.code);
          const currentIndex = PLANS.findIndex(p => p.code === currentPlan);
          const isDowngrade = planIndex < currentIndex;

          return (
            <div
              key={plan.code}
              className={`border rounded-lg p-6 relative ${
                plan.popular ? 'border-indigo-500 ring-1 ring-indigo-500' : ''
              } ${isCurrent ? 'bg-indigo-50' : 'bg-card'}`}
            >
              {'popular' in plan && plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs px-3 py-1 rounded-full">
                  Popular
                </span>
              )}

              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold">${plan.price}</span>
                <span className="text-muted-foreground">/mo</span>
              </div>

              <ul className="mt-4 space-y-2 text-sm">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <button disabled className="w-full py-2 px-4 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed">
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleChangePlan(plan.code)}
                    disabled={changing !== null}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                      isDowngrade
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-indigo-500 text-white hover:bg-indigo-600'
                    } disabled:opacity-50`}
                  >
                    {changing === plan.code ? 'Changing...' : isDowngrade ? 'Downgrade' : 'Upgrade'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cancel Button */}
      {billing && currentPlan !== 'FREE' && !billing.isCancelled && (
        <div className="flex justify-end">
          <button
            onClick={handleCancel}
            disabled={changing !== null}
            className="text-red-600 hover:text-red-700 text-sm underline disabled:opacity-50"
          >
            Cancel Subscription
          </button>
        </div>
      )}
    </div>
  );
}
