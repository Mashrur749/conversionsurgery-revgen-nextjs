'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

type NavGroup = {
  group: string;
  items: { href: string; label: string }[];
};

export function AdminNav({ groups }: { groups: NavGroup[] }) {
  return (
    <div className="flex items-center gap-1">
      {groups.map((group, idx) => {
        const isClient = group.group === 'Client View';
        return (
          <div key={group.group} className="flex items-center">
            {isClient ? null : idx === 1 ? <div className="border-l border-white/20 h-6 mx-1" /> : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap text-white/80 hover:text-white hover:bg-forest-light">
                  {group.group}
                  <ChevronDown className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {group.items.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href} className="cursor-pointer">
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
}
