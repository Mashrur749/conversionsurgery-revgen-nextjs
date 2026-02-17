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

const navItems = [
  { href: '/client', label: 'Dashboard' },
  { href: '/client/conversations', label: 'Conversations' },
  { href: '/client/revenue', label: 'Revenue' },
  { href: '/client/knowledge', label: 'Knowledge Base' },
  { href: '/client/flows', label: 'Flows' },
  { href: '/client/billing', label: 'Billing' },
  { href: '/client/settings', label: 'Settings' },
  { href: '/client/help', label: 'Help' },
  { href: '/client/discussions', label: 'Discussions' },
];

interface ClientNavProps {
  businessName: string;
}

export function ClientNav({ businessName }: ClientNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/client') return pathname === '/client';
    return pathname.startsWith(href);
  };

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
                  {navItems.map((item) => (
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

            <span className="font-semibold text-sm truncate max-w-[200px] text-white">
              {businessName}
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex gap-1">
            {navItems.map((item) => (
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
