'use client';

import { Button } from '@/components/ui/button';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push('/login');
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
    >
      Sign Out
    </Button>
  );
}
