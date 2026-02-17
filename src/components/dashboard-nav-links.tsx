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
              ? 'bg-gray-100 text-gray-900 font-medium'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          )}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}
