# Phase 11b: Phone Number Management UI

## Current State (after Phase 11a)
- Twilio provisioning service and APIs exist
- Can search, purchase, configure numbers via API
- No UI for phone number management

## Goal
Add phone number assignment page for clients.

---

## Step 1: Create Phone Number Assignment Page

**CREATE** `src/app/(dashboard)/admin/clients/[id]/phone/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PhoneNumberManager } from './phone-number-manager';

interface Props {
  params: { id: string };
}

export default async function PhoneNumberPage({ params }: Props) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, params.id))
    .limit(1);

  if (!client) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Phone Number</h1>
          <p className="text-muted-foreground">{client.businessName}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/clients/${client.id}`}>← Back to Client</Link>
        </Button>
      </div>

      <PhoneNumberManager client={client} />
    </div>
  );
}
```

---

## Step 2: Create Phone Number Manager Component

**CREATE** `src/app/(dashboard)/admin/clients/[id]/phone/phone-number-manager.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatPhoneNumber } from '@/lib/utils/phone';

interface Client {
  id: string;
  businessName: string;
  twilioNumber: string | null;
}

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  capabilities: {
    voice: boolean;
    SMS: boolean;
    MMS: boolean;
  };
}

export function PhoneNumberManager({ client }: { client: Client }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(client.twilioNumber ? 'current' : 'search');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="current" disabled={!client.twilioNumber}>
          Current Number
        </TabsTrigger>
        <TabsTrigger value="search">Search New</TabsTrigger>
        <TabsTrigger value="existing">Use Existing</TabsTrigger>
      </TabsList>

      <TabsContent value="current">
        <CurrentNumber client={client} onRelease={() => setActiveTab('search')} />
      </TabsContent>

      <TabsContent value="search">
        <SearchNumbers clientId={client.id} />
      </TabsContent>

      <TabsContent value="existing">
        <UseExistingNumber clientId={client.id} />
      </TabsContent>
    </Tabs>
  );
}

function CurrentNumber({ client, onRelease }: { client: Client; onRelease: () => void }) {
  const router = useRouter();
  const [releasing, setReleasing] = useState(false);
  const [error, setError] = useState('');

  async function handleRelease() {
    if (!confirm('Are you sure you want to release this number? The client will stop receiving messages.')) {
      return;
    }

    setReleasing(true);
    setError('');

    try {
      const res = await fetch('/api/admin/twilio/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to release');
        return;
      }

      router.refresh();
      onRelease();
    } finally {
      setReleasing(false);
    }
  }

  if (!client.twilioNumber) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Phone Number</CardTitle>
        <CardDescription>This number is assigned to {client.businessName}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-3xl font-mono font-bold">
          {formatPhoneNumber(client.twilioNumber)}
        </div>

        <div className="flex gap-2">
          <Badge variant="outline" className="bg-green-50 text-green-700">
            Voice Enabled
          </Badge>
          <Badge variant="outline" className="bg-green-50 text-green-700">
            SMS Enabled
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">
          Webhooks are automatically configured for this number.
        </p>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
            {error}
          </div>
        )}

        <Button
          variant="destructive"
          onClick={handleRelease}
          disabled={releasing}
        >
          {releasing ? 'Releasing...' : 'Release Number'}
        </Button>
      </CardContent>
    </Card>
  );
}

function SearchNumbers({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [areaCode, setAreaCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [error, setError] = useState('');

  async function handleSearch() {
    if (!areaCode || areaCode.length !== 3) {
      setError('Please enter a 3-digit area code');
      return;
    }

    setSearching(true);
    setError('');
    setNumbers([]);

    try {
      const res = await fetch(`/api/admin/twilio/search?areaCode=${areaCode}&country=CA`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to search');
        return;
      }

      setNumbers(data.numbers || []);

      if (data.numbers?.length === 0) {
        setError('No numbers found for this area code. Try a different one.');
      }
    } finally {
      setSearching(false);
    }
  }

  async function handlePurchase(phoneNumber: string) {
    if (!confirm(`Purchase ${formatPhoneNumber(phoneNumber)}? This will charge your Twilio account.`)) {
      return;
    }

    setPurchasing(phoneNumber);
    setError('');

    try {
      const res = await fetch('/api/admin/twilio/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, clientId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to purchase');
        return;
      }

      router.refresh();
      router.push(`/admin/clients/${clientId}`);
    } finally {
      setPurchasing(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Search Available Numbers</CardTitle>
        <CardDescription>Find and purchase a new phone number from Twilio</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="areaCode">Area Code</Label>
            <Input
              id="areaCode"
              value={areaCode}
              onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="403"
              maxLength={3}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
            {error}
          </div>
        )}

        {numbers.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Found {numbers.length} available numbers:
            </p>
            <div className="border rounded-lg divide-y">
              {numbers.map((num) => (
                <div
                  key={num.phoneNumber}
                  className="flex items-center justify-between p-3"
                >
                  <div>
                    <p className="font-mono font-medium">
                      {formatPhoneNumber(num.phoneNumber)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {num.locality}, {num.region}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handlePurchase(num.phoneNumber)}
                    disabled={purchasing !== null}
                  >
                    {purchasing === num.phoneNumber ? 'Purchasing...' : 'Purchase'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UseExistingNumber({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [configuring, setConfiguring] = useState(false);
  const [error, setError] = useState('');

  async function handleConfigure() {
    if (!phoneNumber) {
      setError('Please enter a phone number');
      return;
    }

    setConfiguring(true);
    setError('');

    try {
      const res = await fetch('/api/admin/twilio/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber.replace(/\D/g, ''),
          clientId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to configure');
        return;
      }

      router.refresh();
      router.push(`/admin/clients/${clientId}`);
    } finally {
      setConfiguring(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Use Existing Number</CardTitle>
        <CardDescription>
          Configure a number you already own in Twilio
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="existingNumber">Phone Number</Label>
          <Input
            id="existingNumber"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+14035551234"
          />
          <p className="text-xs text-muted-foreground">
            Enter a number from your Twilio account. Webhooks will be automatically configured.
          </p>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
            {error}
          </div>
        )}

        <Button onClick={handleConfigure} disabled={configuring}>
          {configuring ? 'Configuring...' : 'Configure & Assign'}
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

## Step 3: Add Twilio Account Info to Admin Page

**CREATE** `src/app/(dashboard)/admin/twilio/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getAccountBalance, listOwnedNumbers } from '@/lib/services/twilio-provisioning';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export default async function TwilioAdminPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const [balance, ownedNumbers] = await Promise.all([
    getAccountBalance(),
    listOwnedNumbers(),
  ]);

  // Get assigned numbers
  const assignedClients = await db
    .select({
      twilioNumber: clients.twilioNumber,
      businessName: clients.businessName,
    })
    .from(clients)
    .where(eq(clients.status, 'active'));

  const assignedNumbers = new Set(
    assignedClients.map(c => c.twilioNumber).filter(Boolean)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Twilio Account</h1>
          <p className="text-muted-foreground">Manage your Twilio resources</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin">← Back to Clients</Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account Balance</CardTitle>
          </CardHeader>
          <CardContent>
            {balance ? (
              <div className="text-3xl font-bold">
                {balance.currency} {parseFloat(balance.balance).toFixed(2)}
              </div>
            ) : (
              <p className="text-muted-foreground">Unable to fetch balance</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phone Numbers</CardTitle>
            <CardDescription>
              {ownedNumbers.length} owned, {assignedNumbers.size} assigned
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {ownedNumbers.length - assignedNumbers.size}
            </div>
            <p className="text-sm text-muted-foreground">available to assign</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Numbers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {ownedNumbers.map((num) => {
              const assignedTo = assignedClients.find(
                c => c.twilioNumber === num.phoneNumber
              );

              return (
                <div
                  key={num.sid}
                  className="flex items-center justify-between p-4"
                >
                  <div>
                    <p className="font-mono font-medium">
                      {formatPhoneNumber(num.phoneNumber)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {num.friendlyName}
                    </p>
                  </div>
                  {assignedTo ? (
                    <span className="text-sm text-green-600">
                      → {assignedTo.businessName}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Not assigned
                    </span>
                  )}
                </div>
              );
            })}
            {ownedNumbers.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No phone numbers in your Twilio account
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Step 4: Update Dashboard Layout Navigation

**In** `src/app/(dashboard)/layout.tsx`, update the `adminNavItems` array:

```typescript
const adminNavItems = [
  { href: '/admin', label: 'Clients' },
  { href: '/admin/twilio', label: 'Twilio' },
];
```

---

## Verify

1. `npm run dev`
2. Create a new client without phone number
3. Click "Assign Phone Number" on client detail page
4. Search by area code → see available numbers
5. Purchase number → client becomes active
6. Visit `/admin/twilio` → see all owned numbers
7. Can also configure existing Twilio numbers

---

## Next
Proceed to **Phase 13a** for the setup wizard.
