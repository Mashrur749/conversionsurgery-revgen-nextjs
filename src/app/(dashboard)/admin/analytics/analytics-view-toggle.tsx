'use client';

import Link from 'next/link';

interface Props {
  current: 'category' | 'variants';
}

export function AnalyticsViewToggle({ current }: Props) {
  return (
    <div className="flex gap-1 rounded-md bg-muted p-1">
      <Link
        href="/admin/analytics"
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
          current === 'category'
            ? 'bg-white text-foreground shadow-sm font-medium'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        By Category
      </Link>
      <Link
        href="/admin/analytics?view=variants"
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
          current === 'variants'
            ? 'bg-white text-foreground shadow-sm font-medium'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        All Variants
      </Link>
    </div>
  );
}
