'use client';

import { useRouter } from 'next/navigation';
import { SubscriptionCard } from '@/components/billing/SubscriptionCard';
import { PaymentMethodCard } from '@/components/billing/PaymentMethodCard';
import { InvoiceList } from '@/components/billing/InvoiceList';
import { UsageDisplay } from '@/components/billing/UsageDisplay';
import {
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  addPaymentMethod,
  removePaymentMethod,
  setDefaultPaymentMethod,
} from '@/lib/billing/actions';

interface BillingPageClientProps {
  clientId: string;
  data: {
    subscription: {
      id: string;
      status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused';
      plan: {
        id: string;
        name: string;
        priceMonthly: number;
        features: {
          maxLeadsPerMonth: number | null;
          maxTeamMembers: number | null;
          maxPhoneNumbers: number;
          includesVoiceAi: boolean;
          includesCalendarSync: boolean;
          includesAdvancedAnalytics: boolean;
          includesWhiteLabel: boolean;
          supportLevel: string;
          apiAccess: boolean;
        };
      };
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      trialEnd: Date | null;
      cancelAtPeriodEnd: boolean;
      discountPercent: number | null;
    } | null;
    paymentMethods: {
      id: string;
      type: string;
      isDefault: boolean;
      card?: { brand: string; last4: string; expMonth: number; expYear: number };
      bankAccount?: { bankName: string; last4: string };
    }[];
    invoices: {
      id: string;
      number: string;
      status: string;
      amountDue: number;
      amountPaid: number;
      createdAt: Date;
      dueDate: Date | null;
      paidAt: Date | null;
      pdfUrl: string | null;
      hostedInvoiceUrl: string | null;
      lineItems: { description: string; totalCents: number; quantity: number }[];
    }[];
    usage: {
      leads: { used: number; included: number | null; overage: number };
      teamMembers: { used: number; included: number };
      phoneNumbers: { used: number; included: number };
    } | null;
  };
}

export function BillingPageClient({ clientId, data }: BillingPageClientProps) {
  const router = useRouter();
  const { subscription, paymentMethods, invoices, usage } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription, payment methods, and invoices.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {subscription && (
            <SubscriptionCard
              subscription={subscription}
              usage={usage ? { leads: usage.leads.used, messages: 0 } : undefined}
              onUpgrade={() => router.push('/client/billing/upgrade')}
              onCancelSubscription={async (reason) => {
                await cancelSubscription(clientId, reason);
                router.refresh();
              }}
              onPauseSubscription={async (resumeDate) => {
                await pauseSubscription(clientId, resumeDate);
                router.refresh();
              }}
              onResumeSubscription={async () => {
                await resumeSubscription(clientId);
                router.refresh();
              }}
            />
          )}

          {!subscription && (
            <div className="rounded-lg border p-6 text-center">
              <h3 className="text-lg font-medium">No Active Subscription</h3>
              <p className="text-muted-foreground mt-1">
                Choose a plan to get started with ConversionSurgery.
              </p>
              <button
                onClick={() => router.push('/client/billing/upgrade')}
                className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                View Plans
              </button>
            </div>
          )}

          {usage && subscription && (
            <UsageDisplay
              usage={usage}
              periodStart={subscription.currentPeriodStart}
              periodEnd={subscription.currentPeriodEnd}
            />
          )}
        </div>

        <div className="space-y-6">
          <PaymentMethodCard
            paymentMethods={paymentMethods}
            onAddPaymentMethod={async (paymentMethodId) => {
              await addPaymentMethod(clientId, paymentMethodId);
              router.refresh();
            }}
            onRemovePaymentMethod={async (id) => {
              await removePaymentMethod(clientId, id);
              router.refresh();
            }}
            onSetDefault={async (id) => {
              await setDefaultPaymentMethod(clientId, id);
              router.refresh();
            }}
            hasFailedPayment={subscription?.status === 'past_due'}
          />
        </div>
      </div>

      <InvoiceList invoices={invoices} />
    </div>
  );
}
