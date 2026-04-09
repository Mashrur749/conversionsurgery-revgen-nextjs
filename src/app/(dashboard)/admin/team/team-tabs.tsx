'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, type ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const TAB_VALUES = ['members', 'roles', 'users'] as const;
type TabValue = (typeof TAB_VALUES)[number];

interface TeamTabsProps {
  membersContent: ReactNode;
  rolesContent: ReactNode;
  usersContent: ReactNode;
}

function isValidTab(value: string | null): value is TabValue {
  return TAB_VALUES.includes(value as TabValue);
}

export function TeamTabs({ membersContent, rolesContent, usersContent }: TeamTabsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawTab = searchParams.get('tab');
  const currentTab: TabValue = isValidTab(rawTab) ? rawTab : 'members';

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'members') {
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
      <TabsList className="w-full grid grid-cols-3">
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="roles">Roles</TabsTrigger>
        <TabsTrigger value="users">Portal Users</TabsTrigger>
      </TabsList>

      <TabsContent value="members" className="mt-4">
        {membersContent}
      </TabsContent>

      <TabsContent value="roles" className="mt-4">
        {rolesContent}
      </TabsContent>

      <TabsContent value="users" className="mt-4">
        {usersContent}
      </TabsContent>
    </Tabs>
  );
}
