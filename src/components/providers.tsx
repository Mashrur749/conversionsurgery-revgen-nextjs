'use client';

import { SessionProvider } from 'next-auth/react';
import { AdminProvider } from '@/lib/admin-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AdminProvider>
        {children}
      </AdminProvider>
    </SessionProvider>
  );
}
