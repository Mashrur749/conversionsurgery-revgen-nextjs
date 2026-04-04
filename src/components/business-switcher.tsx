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
  const [switchError, setSwitchError] = useState('');

  async function handleSwitch(clientId: string) {
    if (clientId === currentClientId || switching) return;

    setSwitching(true);
    setSwitchError('');
    try {
      const res = await fetch('/api/client/auth/switch-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });

      if (!res.ok) {
        setSwitchError('Failed to switch. Please try again.');
        setSwitching(false);
        return;
      }

      router.push('/client');
      router.refresh();
    } catch {
      setSwitchError('Failed to switch. Please try again.');
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
    <div>
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
              <Check className="size-4 shrink-0 text-[#3D7A50]" />
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
    {switchError && (
      <p className="text-xs text-[#C15B2E] mt-1">{switchError}</p>
    )}
    </div>
  );
}
