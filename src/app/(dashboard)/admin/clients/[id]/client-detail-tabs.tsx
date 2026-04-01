'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, type ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

const TAB_VALUES = ['overview', 'configuration', 'team-billing', 'activity'] as const;
type TabValue = (typeof TAB_VALUES)[number];

interface ClientDetailTabsProps {
  teamMemberCount: number;
  /* Tab 1: Overview */
  onboardingChecklist: ReactNode | null;
  roiDashboard: ReactNode;
  usageCard: ReactNode;
  dayOneActivationCard: ReactNode;
  /* Tab 2: Configuration */
  featureToggles: ReactNode;
  featureStatusList: ReactNode;
  onboardingQualityPanel: ReactNode;
  reminderRoutingPanel: ReactNode;
  embedWidgetCard: ReactNode;
  /* Tab 3: Team & Billing */
  clientInfoCard: ReactNode;
  phoneNumberCard: ReactNode;
  teamMembersCard: ReactNode;
  addonProvenanceCard: ReactNode;
  /* Tab 4: Activity */
  actionsCard: ReactNode;
  quarterlyCampaignsCard: ReactNode;
  dangerZone: ReactNode;
}

function isValidTab(value: string | null): value is TabValue {
  return TAB_VALUES.includes(value as TabValue);
}

export function ClientDetailTabs({
  teamMemberCount,
  onboardingChecklist,
  roiDashboard,
  usageCard,
  dayOneActivationCard,
  featureToggles,
  featureStatusList,
  onboardingQualityPanel,
  reminderRoutingPanel,
  embedWidgetCard,
  clientInfoCard,
  phoneNumberCard,
  teamMembersCard,
  addonProvenanceCard,
  actionsCard,
  quarterlyCampaignsCard,
  dangerZone,
}: ClientDetailTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawTab = searchParams.get('tab');
  const currentTab: TabValue = isValidTab(rawTab) ? rawTab : 'overview';

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'overview') {
        params.delete('tab');
      } else {
        params.set('tab', value);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange}>
      <TabsList className="w-full grid grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="configuration">Configuration</TabsTrigger>
        <TabsTrigger value="team-billing" className="gap-1.5">
          Team &amp; Billing
          {teamMemberCount > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
              {teamMemberCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6 mt-4">
        {onboardingChecklist}
        {roiDashboard}
        {usageCard}
        {dayOneActivationCard}
      </TabsContent>

      <TabsContent value="configuration" className="space-y-6 mt-4">
        {featureToggles}
        {featureStatusList}
        {onboardingQualityPanel}
        {reminderRoutingPanel}
        {embedWidgetCard}
      </TabsContent>

      <TabsContent value="team-billing" className="space-y-6 mt-4">
        {clientInfoCard}
        {phoneNumberCard}
        {teamMembersCard}
        {addonProvenanceCard}
      </TabsContent>

      <TabsContent value="activity" className="space-y-6 mt-4">
        {actionsCard}
        {quarterlyCampaignsCard}
        {dangerZone}
      </TabsContent>
    </Tabs>
  );
}
