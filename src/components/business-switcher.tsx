'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { clearClientSessionCookieAction } from '@/app/(client)/actions';

interface Business {
  clientId: string;
  businessName: string;
}

interface BusinessSwitcherProps {
  currentClientId: string;
  currentBusinessName: string;
  businesses: Business[];
}

export function BusinessSwitcher({
  currentClientId,
  currentBusinessName,
  businesses,
}: BusinessSwitcherProps) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  async function handleSwitch(clientId: string) {
    if (clientId === currentClientId || switching) return;

    setSwitching(true);
    try {
      const res = await fetch('/api/client/auth/switch-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });

      if (!res.ok) {
        console.error('Failed to switch business');
        setSwitching(false);
        return;
      }

      router.push('/client');
      router.refresh();
    } catch (error) {
      console.error('Error switching business:', error);
      setSwitching(false);
    }
  }

  async function handleSignOut() {
    try {
      await clearClientSessionCookieAction();
      router.push('/client-login');
    } catch {
      // Force navigation even if action fails
      router.push('/client-login');
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="text-white hover:bg-forest-light gap-1.5 px-2 font-semibold text-sm truncate max-w-[200px]"
          disabled={switching}
        >
          {switching ? 'Switching...' : currentBusinessName}
          <ChevronDown className="size-3.5 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {businesses.map((b) => (
          <DropdownMenuItem
            key={b.clientId}
            onClick={() => handleSwitch(b.clientId)}
            className="flex items-center justify-between"
            disabled={switching}
          >
            <span className="truncate">{b.businessName}</span>
            {b.clientId === currentClientId && (
              <Check className="size-4 shrink-0 text-green-600" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
          <LogOut className="size-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
