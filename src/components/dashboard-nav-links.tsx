'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
}

export function DashboardNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <>
      {items.map((item) => (
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
    </>
  );
}
