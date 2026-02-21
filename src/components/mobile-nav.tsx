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
  isAgency: boolean;
}

export function MobileNav({ navItems, adminGroups, isAgency }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden text-white hover:bg-forest-light">
          <Menu className="size-5" />
          <span className="sr-only">Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="px-4 py-4 bg-forest text-white border-b border-forest-light">
          <SheetTitle className="text-left text-white">ConversionSurgery</SheetTitle>
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
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {isAgency && adminGroups && (
            <>
              <div className="border-t mx-4 my-2" />
              {adminGroups.map((group) => (
                <div key={group.group} className="p-2">
                  <p className="px-3 py-1 text-xs font-semibold text-olive uppercase tracking-wider">
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
                          ? 'bg-accent text-forest font-medium'
                          : 'text-forest-light hover:text-forest hover:bg-accent'
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
