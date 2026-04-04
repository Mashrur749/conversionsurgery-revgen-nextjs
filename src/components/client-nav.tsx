'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { BusinessSwitcher } from '@/components/business-switcher';

interface NavItem {
  href: string;
  label: string;
  permission?: string;
  selfServeOnly?: boolean; // hidden when serviceModel='managed'
}

/**
 * Navigation items with optional permission gating.
 * Items without a permission are always shown.
 */
const navItems: NavItem[] = [
  { href: '/client', label: 'Dashboard', permission: PORTAL_PERMISSIONS.DASHBOARD },
  { href: '/client/conversations', label: 'Conversations', permission: PORTAL_PERMISSIONS.CONVERSATIONS_VIEW },
  { href: '/client/revenue', label: 'Revenue', permission: PORTAL_PERMISSIONS.REVENUE_VIEW },
  { href: '/client/knowledge', label: 'Knowledge Base', permission: PORTAL_PERMISSIONS.KNOWLEDGE_VIEW },
  { href: '/client/flows', label: 'Flows', selfServeOnly: true },
  { href: '/client/team', label: 'Team', permission: PORTAL_PERMISSIONS.TEAM_VIEW },
  { href: '/client/billing', label: 'Billing' },
  { href: '/client/settings', label: 'Settings', permission: PORTAL_PERMISSIONS.SETTINGS_VIEW },
  { href: '/client/help', label: 'Help' },
  { href: '/client/discussions', label: 'Discussions' },
];

interface Business {
  clientId: string;
  businessName: string;
}

interface ClientNavProps {
  businessName: string;
  permissions?: string[];
  showSwitcher?: boolean;
  businesses?: Business[];
  currentClientId?: string;
  serviceModel?: string; // 'managed' | 'self_serve'
}

export function ClientNav({
  businessName,
  permissions = [],
  showSwitcher = false,
  businesses,
  currentClientId,
  serviceModel = 'managed',
}: ClientNavProps) {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    interface MessageSummary {
      id: string;
      lastReplyAt: string | null;
      replyCount: number;
    }

    async function checkUnread() {
      try {
        const res = await fetch('/api/support-messages');
        if (!res.ok) return;
        const data = await res.json() as { messages: MessageSummary[] };
        const read = JSON.parse(localStorage.getItem('cs_discussions_read') ?? '{}') as Record<string, string>;
        const unread = data.messages.some((m) => {
          if (!m.lastReplyAt || m.replyCount === 0) return false;
          const lastRead = read[m.id];
          if (!lastRead) return true;
          return new Date(m.lastReplyAt) > new Date(lastRead);
        });
        setHasUnread(unread);
      } catch {
        // Silently ignore errors
      }
    }

    checkUnread();
    const interval = setInterval(checkUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (href: string) => {
    if (href === '/client') return pathname === '/client';
    return pathname.startsWith(href);
  };

  // Filter nav items by permission and service model
  const visibleItems = navItems.filter((item) => {
    // If no permissions array provided (legacy), show all items
    if (permissions.length === 0) return true;
    if (item.permission && !permissions.includes(item.permission)) return false;
    if (item.selfServeOnly && serviceModel === 'managed') return false;
    return true;
  });

  return (
    <header className="bg-forest text-white sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex justify-between items-center h-14">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden text-white hover:bg-forest-light">
                  <Menu className="size-5" />
                  <span className="sr-only">Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="px-4 py-4 bg-forest text-white border-b border-forest-light">
                  <SheetTitle className="text-left text-white">{businessName}</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col overflow-y-auto h-[calc(100%-65px)] p-2">
                  {visibleItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center px-3 py-2.5 text-sm rounded-md transition-colors',
                        isActive(item.href)
                          ? 'bg-accent text-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      )}
                    >
                      {item.label}
                      {item.href === '/client/discussions' && hasUnread && (
                        <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-[#D4754A] flex-shrink-0" />
                      )}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

            {/* Business name or switcher */}
            {showSwitcher && businesses && currentClientId ? (
              <BusinessSwitcher
                currentClientId={currentClientId}
                currentBusinessName={businessName}
                businesses={businesses}
              />
            ) : (
              <span className="font-semibold text-sm truncate max-w-[200px] text-white">
                {businessName}
              </span>
            )}
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex gap-1">
            {visibleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center px-3 py-2 text-sm rounded-md transition-colors',
                  isActive(item.href)
                    ? 'bg-forest-light text-white font-medium'
                    : 'text-white/70 hover:text-white hover:bg-forest-light'
                )}
              >
                {item.label}
                {item.href === '/client/discussions' && hasUnread && (
                  <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-[#D4754A] flex-shrink-0" />
                )}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
