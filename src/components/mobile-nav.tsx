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

type NavItem = { href: string; label: string };
type NavGroup = { group: string; items: NavItem[] };

interface MobileNavProps {
  navItems: NavItem[];
  adminGroups?: NavGroup[];
  isAdmin: boolean;
}

export function MobileNav({ navItems, adminGroups, isAdmin }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="size-5" />
          <span className="sr-only">Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="px-4 py-4 border-b">
          <SheetTitle className="text-left">Revenue Recovery</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col overflow-y-auto h-[calc(100%-65px)]">
          <div className="p-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'block px-3 py-2.5 text-sm rounded-md transition-colors',
                  pathname === item.href
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {isAdmin && adminGroups && (
            <>
              <div className="border-t mx-4 my-2" />
              {adminGroups.map((group) => (
                <div key={group.group} className="p-2">
                  <p className="px-3 py-1 text-xs font-semibold text-amber-700 uppercase tracking-wider">
                    {group.group}
                  </p>
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'block px-3 py-2.5 text-sm rounded-md transition-colors',
                        pathname === item.href
                          ? 'bg-amber-50 text-amber-900 font-medium'
                          : 'text-amber-700 hover:text-amber-900 hover:bg-amber-50'
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ))}
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
