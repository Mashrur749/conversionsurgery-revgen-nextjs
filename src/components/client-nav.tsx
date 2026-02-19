'use client';

import { useState } from 'react';
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
  { href: '/client/flows', label: 'Flows' },
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
}

export function ClientNav({
  businessName,
  permissions = [],
  showSwitcher = false,
  businesses,
  currentClientId,
}: ClientNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/client') return pathname === '/client';
    return pathname.startsWith(href);
  };

  // Filter nav items by permission
  const visibleItems = navItems.filter((item) => {
    // If no permissions array provided (legacy), show all items
    if (permissions.length === 0) return true;
    // Items without a permission requirement are always visible
    if (!item.permission) return true;
    return permissions.includes(item.permission);
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
                        'block px-3 py-2.5 text-sm rounded-md transition-colors',
                        isActive(item.href)
                          ? 'bg-accent text-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      )}
                    >
                      {item.label}
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
                  'px-3 py-2 text-sm rounded-md transition-colors',
                  isActive(item.href)
                    ? 'bg-forest-light text-white font-medium'
                    : 'text-white/70 hover:text-white hover:bg-forest-light'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
