'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, Suspense } from 'react';
import { Bell, Bot, Phone, Settings2, ToggleLeft } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const TAB_IDS = ['general', 'notifications', 'ai', 'phone', 'features'] as const;
type TabId = (typeof TAB_IDS)[number];

const TAB_META: Record<TabId, { label: string; icon: React.ReactNode }> = {
  general: { label: 'General', icon: <Settings2 className="h-4 w-4" /> },
  notifications: { label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  ai: { label: 'AI Assistant', icon: <Bot className="h-4 w-4" /> },
  phone: { label: 'Phone', icon: <Phone className="h-4 w-4" /> },
  features: { label: 'Features', icon: <ToggleLeft className="h-4 w-4" /> },
};

interface SettingsTabsProps {
  children: Record<TabId, React.ReactNode>;
  serviceModel?: string;
}

function SettingsTabsInner({ children, serviceModel }: SettingsTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab');

  const visibleTabs: TabId[] = serviceModel === 'managed'
    ? (TAB_IDS as readonly TabId[]).filter(id => !['ai', 'phone', 'features'].includes(id))
    : [...TAB_IDS];

  const activeTab: TabId = rawTab && TAB_IDS.includes(rawTab as TabId) && visibleTabs.includes(rawTab as TabId)
    ? (rawTab as TabId)
    : 'general';

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'general') {
        params.delete('tab');
      } else {
        params.set('tab', value);
      }
      const query = params.toString();
      router.push(`/client/settings${query ? `?${query}` : ''}`, { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      orientation="vertical"
      className="md:flex-row flex-col"
    >
      {/* Desktop: vertical sidebar tabs. Mobile: horizontal scrollable tabs */}
      <TabsList
        variant="line"
        className="md:flex-col md:w-52 md:items-stretch md:border-r md:border-border md:pr-4 md:h-auto
                   flex-row overflow-x-auto w-full border-b border-border pb-2 md:pb-0 md:border-b-0
                   shrink-0"
      >
        {visibleTabs.map((id) => (
          <TabsTrigger
            key={id}
            value={id}
            className="md:justify-start justify-center gap-2 px-3 py-2 text-sm"
          >
            {TAB_META[id].icon}
            <span className="hidden sm:inline">{TAB_META[id].label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="flex-1 min-w-0 md:pl-2">
        {visibleTabs.map((id) => (
          <TabsContent key={id} value={id}>
            {children[id]}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}

export function SettingsTabs(props: SettingsTabsProps) {
  return (
    <Suspense>
      <SettingsTabsInner {...props} />
    </Suspense>
  );
}

