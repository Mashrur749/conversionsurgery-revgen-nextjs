'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, type ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

const TAB_VALUES = ['overview', 'knowledge', 'configuration', 'team-billing', 'campaigns'] as const;
type TabValue = (typeof TAB_VALUES)[number];

interface ClientDetailTabsProps {
  teamMemberCount: number;
  /* Tab 1: Overview */
  onboardingChecklist: ReactNode | null;
  roiDashboard: ReactNode;
  leadsNeedingFollowupCard?: ReactNode;
  dayOneActivationCard: ReactNode;
  guaranteeStatusCard?: ReactNode;
  engagementHealthBadge?: ReactNode;
  onboardingQualityPanel: ReactNode;
  /* Tab 2: Knowledge */
  knowledgeContent: ReactNode;
  /* Tab 3: Configuration */
  featureToggles: ReactNode;
  smartAssistCard?: ReactNode;
  reminderRoutingPanel: ReactNode;
  embedWidgetCard: ReactNode;
  calendarIntegrationCard: ReactNode;
  dncCard?: ReactNode;
  integrationsCard?: ReactNode;
  /* Tab 4: Team & Billing */
  clientInfoCard: ReactNode;
  phoneNumberCard: ReactNode;
  teamMembersCard: ReactNode;
  addonProvenanceCard: ReactNode;
  usageCard: ReactNode;
  /* Tab 5: Campaigns */
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
  leadsNeedingFollowupCard,
  dayOneActivationCard,
  guaranteeStatusCard,
  engagementHealthBadge,
  onboardingQualityPanel,
  knowledgeContent,
  featureToggles,
  smartAssistCard,
  reminderRoutingPanel,
  embedWidgetCard,
  calendarIntegrationCard,
  dncCard,
  integrationsCard,
  clientInfoCard,
  phoneNumberCard,
  teamMembersCard,
  addonProvenanceCard,
  usageCard,
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
      <TabsList className="w-full flex overflow-x-auto whitespace-nowrap sm:grid sm:grid-cols-5">
        <TabsTrigger value="overview" className="shrink-0">Overview</TabsTrigger>
        <TabsTrigger value="knowledge" className="shrink-0">Knowledge</TabsTrigger>
        <TabsTrigger value="configuration" className="shrink-0">Configuration</TabsTrigger>
        <TabsTrigger value="team-billing" className="shrink-0 gap-1.5">
          Team &amp; Billing
          {teamMemberCount > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
              {teamMemberCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="campaigns" className="shrink-0">Campaigns</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6 mt-4">
        {engagementHealthBadge}
        {onboardingChecklist}
        {roiDashboard}
        {leadsNeedingFollowupCard}
        {guaranteeStatusCard}
        {dayOneActivationCard}
        {onboardingQualityPanel}
      </TabsContent>

      <TabsContent value="knowledge" className="space-y-6 mt-4">
        {knowledgeContent}
      </TabsContent>

      <TabsContent value="configuration" className="space-y-6 mt-4">
        {featureToggles}
        {smartAssistCard}
        {reminderRoutingPanel}
        {embedWidgetCard}
        {calendarIntegrationCard}
        {integrationsCard}
        {dncCard}
      </TabsContent>

      <TabsContent value="team-billing" className="space-y-6 mt-4">
        {clientInfoCard}
        {phoneNumberCard}
        {teamMembersCard}
        {addonProvenanceCard}
        {usageCard}
      </TabsContent>

      <TabsContent value="campaigns" className="space-y-6 mt-4">
        {quarterlyCampaignsCard}
        {dangerZone}
      </TabsContent>
    </Tabs>
  );
}
