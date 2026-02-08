# Phase 7b: Admin UI Components

## Current State (after Phase 7a)
- Schema has `isAdmin` field on users
- Auth returns `session.user.isAdmin`
- You are marked as admin in database

## Goal
Add admin context provider, client selector dropdown, and helper functions.

---

## Step 1: Install Select Component

```bash
npx shadcn@latest add select
```

---

## Step 2: Create Admin Context

**CREATE** `src/lib/admin-context.tsx`:

```typescript
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Client {
  id: string;
  businessName: string;
  ownerName: string;
}

interface AdminContextType {
  selectedClientId: string | null;
  selectedClient: Client | null;
  setSelectedClientId: (id: string | null) => void;
  clients: Client[];
  setClients: (clients: Client[]) => void;
  isLoading: boolean;
}

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [selectedClientId, setSelectedClientIdState] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('adminSelectedClientId');
    if (stored) {
      setSelectedClientIdState(stored);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (selectedClientId && clients.length > 0) {
      const client = clients.find(c => c.id === selectedClientId);
      setSelectedClient(client || null);
    } else {
      setSelectedClient(null);
    }
  }, [selectedClientId, clients]);

  const setSelectedClientId = (id: string | null) => {
    setSelectedClientIdState(id);
    if (id) {
      localStorage.setItem('adminSelectedClientId', id);
      document.cookie = `adminSelectedClientId=${id}; path=/; max-age=31536000`;
    } else {
      localStorage.removeItem('adminSelectedClientId');
      document.cookie = 'adminSelectedClientId=; path=/; max-age=0';
    }
  };

  return (
    <AdminContext.Provider value={{
      selectedClientId,
      selectedClient,
      setSelectedClientId,
      clients,
      setClients,
      isLoading,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
}
```

---

## Step 3: Update Providers

**REPLACE** entire `src/components/providers.tsx`:

```typescript
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
```

---

## Step 4: Create Client Selector Component

**CREATE** `src/components/admin/client-selector.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { useAdmin } from '@/lib/admin-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface Client {
  id: string;
  businessName: string;
  ownerName: string;
}

interface Props {
  clients: Client[];
}

export function ClientSelector({ clients }: Props) {
  const { selectedClientId, setSelectedClientId, setClients } = useAdmin();

  useEffect(() => {
    setClients(clients);
    if (!selectedClientId && clients.length > 0) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId, setClients, setSelectedClientId]);

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
        Admin
      </Badge>
      <Select
        value={selectedClientId || ''}
        onValueChange={(value) => setSelectedClientId(value || null)}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Select client..." />
        </SelectTrigger>
        <SelectContent>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.businessName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

---

## Step 5: Create Server-Side Client ID Helper

**CREATE** `src/lib/get-client-id.ts`:

```typescript
import { auth } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function getClientId(): Promise<string | null> {
  const session = await auth();

  if (!session) return null;

  const isAdmin = session.user?.isAdmin || false;

  if (isAdmin) {
    const cookieStore = cookies();
    const adminClientId = cookieStore.get('adminSelectedClientId')?.value;
    return adminClientId || null;
  }

  return (session as any)?.client?.id || null;
}
```

---

## Step 6: Create Client-Side Hook

**CREATE** `src/lib/hooks/use-client-id.ts`:

```typescript
'use client';

import { useSession } from 'next-auth/react';
import { useAdmin } from '@/lib/admin-context';

export function useClientId(): string | null {
  const { data: session } = useSession();
  const { selectedClientId } = useAdmin();

  const isAdmin = session?.user?.isAdmin || false;

  if (isAdmin) {
    return selectedClientId;
  }

  return (session as any)?.client?.id || null;
}
```

---

## Verify

1. `npm run dev`
2. No errors on startup
3. Files exist at:
   - `src/lib/admin-context.tsx`
   - `src/components/admin/client-selector.tsx`
   - `src/lib/get-client-id.ts`
   - `src/lib/hooks/use-client-id.ts`

---

## Next
Proceed to **Phase 7c** to update dashboard layout and pages.
