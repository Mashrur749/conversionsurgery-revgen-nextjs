'use client';

import { useRouter } from 'next/navigation';
import { PlanSelector } from '@/components/billing/PlanSelector';
import { changePlan } from '@/lib/billing/actions';
import type { Plan } from '@/db/schema/plans';

interface UpgradePageClientProps {
  clientId: string;
  plans: Plan[];
  currentPlanId: string | null;
}

export function UpgradePageClient({
  clientId,
  plans,
  currentPlanId,
}: UpgradePageClientProps) {
  const router = useRouter();

  const planData = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
    features: plan.features as {
      maxLeadsPerMonth: number | null;
      maxTeamMembers: number | null;
      maxPhoneNumbers: number;
      includesVoiceAi: boolean;
      includesCalendarSync: boolean;
      includesAdvancedAnalytics: boolean;
      includesWhiteLabel: boolean;
      supportLevel: string;
      apiAccess: boolean;
    },
    isPopular: plan.isPopular ?? false,
  }));

  return (
    <div className="space-y-6">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Choose Your Plan</h1>
        <p className="text-muted-foreground mt-2">
          Upgrade or downgrade your subscription at any time. Changes take effect
          at the start of your next billing cycle.
        </p>
      </div>

      <PlanSelector
        plans={planData}
        currentPlanId={currentPlanId}
        onSelectPlan={async (planId, billingCycle) => {
          await changePlan(clientId, planId, billingCycle);
          router.push('/client/billing');
        }}
      />
    </div>
  );
}
