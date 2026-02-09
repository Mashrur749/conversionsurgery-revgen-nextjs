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

      const data = (await res.json()) as { error?: string };

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
      const data = (await res.json()) as { numbers?: AvailableNumber[]; error?: string };

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

      const data = (await res.json()) as { error?: string };

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

      const data = (await res.json()) as { error?: string };

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
