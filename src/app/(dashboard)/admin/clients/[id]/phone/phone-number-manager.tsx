'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatPhoneNumber } from '@/lib/utils/phone';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PhoneManagerClient {
  id: string;
  businessName: string;
  twilioNumber: string | null;
}

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
}

interface OwnedNumber {
  phoneNumber: string;
  friendlyName: string;
  sid: string;
}

// ---------------------------------------------------------------------------
// Location data (shared with wizard)
// ---------------------------------------------------------------------------

const COUNTRIES = [
  { code: 'CA', name: 'Canada' },
  { code: 'US', name: 'United States' },
] as const;

const PROVINCES: Record<string, { code: string; name: string }[]> = {
  CA: [
    { code: 'AB', name: 'Alberta' },
    { code: 'BC', name: 'British Columbia' },
    { code: 'MB', name: 'Manitoba' },
    { code: 'NB', name: 'New Brunswick' },
    { code: 'NL', name: 'Newfoundland and Labrador' },
    { code: 'NS', name: 'Nova Scotia' },
    { code: 'NT', name: 'Northwest Territories' },
    { code: 'NU', name: 'Nunavut' },
    { code: 'ON', name: 'Ontario' },
    { code: 'PE', name: 'Prince Edward Island' },
    { code: 'QC', name: 'Quebec' },
    { code: 'SK', name: 'Saskatchewan' },
    { code: 'YT', name: 'Yukon' },
  ],
  US: [
    { code: 'AL', name: 'Alabama' },
    { code: 'AK', name: 'Alaska' },
    { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' },
    { code: 'CA', name: 'California' },
    { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' },
    { code: 'DE', name: 'Delaware' },
    { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' },
    { code: 'HI', name: 'Hawaii' },
    { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' },
    { code: 'IN', name: 'Indiana' },
    { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' },
    { code: 'KY', name: 'Kentucky' },
    { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' },
    { code: 'MD', name: 'Maryland' },
    { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' },
    { code: 'MN', name: 'Minnesota' },
    { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' },
    { code: 'MT', name: 'Montana' },
    { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' },
    { code: 'NH', name: 'New Hampshire' },
    { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' },
    { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' },
    { code: 'OH', name: 'Ohio' },
    { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' },
    { code: 'PA', name: 'Pennsylvania' },
    { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' },
    { code: 'SD', name: 'South Dakota' },
    { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' },
    { code: 'UT', name: 'Utah' },
    { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' },
    { code: 'WA', name: 'Washington' },
    { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' },
    { code: 'WY', name: 'Wyoming' },
  ],
};

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function PhoneNumberManager({ client }: { client: PhoneManagerClient }) {
  const defaultTab = client.twilioNumber ? 'current' : 'existing';

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="w-full">
        <TabsTrigger value="current" disabled={!client.twilioNumber} className="flex-1">
          Current Number
        </TabsTrigger>
        <TabsTrigger value="existing" className="flex-1">
          Your Numbers
        </TabsTrigger>
        <TabsTrigger value="new" className="flex-1">
          Buy New Number
        </TabsTrigger>
      </TabsList>

      <TabsContent value="current">
        <CurrentNumber client={client} />
      </TabsContent>

      <TabsContent value="existing">
        <UnassignedNumbers clientId={client.id} />
      </TabsContent>

      <TabsContent value="new">
        <SearchNumbers clientId={client.id} />
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Current Number
// ---------------------------------------------------------------------------

function CurrentNumber({ client }: { client: PhoneManagerClient }) {
  const router = useRouter();
  const [releasing, setReleasing] = useState(false);
  const [error, setError] = useState('');

  async function handleRelease() {
    if (
      !confirm(
        'Are you sure you want to release this number? The client will stop receiving messages.',
      )
    ) {
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
    } finally {
      setReleasing(false);
    }
  }

  if (!client.twilioNumber) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Current Phone Number</CardTitle>
        <CardDescription>Assigned to {client.businessName}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-3xl font-mono font-bold">
          {formatPhoneNumber(client.twilioNumber)}
        </div>

        <div className="flex gap-2">
          <Badge variant="outline" className="bg-green-50 text-green-700">
            Voice
          </Badge>
          <Badge variant="outline" className="bg-green-50 text-green-700">
            SMS
          </Badge>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">{error}</div>
        )}

        <Button variant="destructive" onClick={handleRelease} disabled={releasing}>
          {releasing ? 'Releasing...' : 'Release Number'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Your Numbers (unassigned from account)
// ---------------------------------------------------------------------------

function UnassignedNumbers({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [numbers, setNumbers] = useState<OwnedNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/twilio/unassigned');
        const data = (await res.json()) as { numbers?: OwnedNumber[] };
        if (res.ok && data.numbers) {
          setNumbers(data.numbers);
        }
      } catch (err) {
        console.error('Failed to load unassigned numbers:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function handleAssign(phoneNumber: string) {
    setAssigning(phoneNumber);
    setError('');

    try {
      const res = await fetch('/api/admin/twilio/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, clientId }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error || 'Failed to assign number');
        return;
      }

      router.refresh();
      router.push(`/admin/clients/${clientId}`);
    } finally {
      setAssigning(null);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Your Numbers</CardTitle>
        <CardDescription>
          Twilio numbers on your account not assigned to any client
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-3 mb-4 text-sm text-red-600 bg-red-50 rounded-lg">{error}</div>
        )}

        {loading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Loading your Twilio numbers...
          </div>
        ) : numbers.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              No unassigned numbers on your Twilio account.
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Switch to &quot;Buy New Number&quot; to search and purchase one.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {numbers.length} unassigned{' '}
              {numbers.length === 1 ? 'number' : 'numbers'} on your account:
            </p>
            <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
              {numbers.map((num) => (
                <div
                  key={num.sid}
                  className="flex items-center justify-between p-3 hover:bg-muted/50"
                >
                  <div>
                    <p className="font-mono font-medium">
                      {formatPhoneNumber(num.phoneNumber)}
                    </p>
                    <p className="text-xs text-muted-foreground">{num.friendlyName}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAssign(num.phoneNumber)}
                    disabled={assigning !== null}
                  >
                    {assigning === num.phoneNumber ? 'Assigning...' : 'Assign'}
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

// ---------------------------------------------------------------------------
// Tab 3: Buy New Number (location-based search)
// ---------------------------------------------------------------------------

function SearchNumbers({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [country, setCountry] = useState('CA');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [results, setResults] = useState<AvailableNumber[]>([]);
  const [error, setError] = useState('');

  const regionOptions = PROVINCES[country] || [];

  async function handleSearch() {
    if (!region) {
      setError('Please select a province or state');
      return;
    }

    setSearching(true);
    setError('');
    setResults([]);

    try {
      const params = new URLSearchParams({ country, inRegion: region });
      if (city.trim()) {
        params.set('inLocality', city.trim());
      }

      const res = await fetch(`/api/admin/twilio/search?${params}`);
      const data = (await res.json()) as {
        error?: string;
        numbers?: AvailableNumber[];
      };

      if (!res.ok) {
        setError(data.error || 'Failed to search');
        return;
      }

      const found = data.numbers || [];
      setResults(found);

      if (found.length === 0) {
        const regionName =
          PROVINCES[country]?.find((p) => p.code === region)?.name || region;
        setError(
          `No numbers found in ${regionName}${city ? `, ${city}` : ''}. Try a different location.`,
        );
      }
    } finally {
      setSearching(false);
    }
  }

  async function handlePurchase(phoneNumber: string) {
    if (
      !confirm(
        `Purchase ${formatPhoneNumber(phoneNumber)}? This will charge your Twilio account.`,
      )
    ) {
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
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Buy New Number</CardTitle>
        <CardDescription>
          Search and purchase a phone number from Twilio
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Country</Label>
            <Select
              value={country}
              onValueChange={(val) => {
                setCountry(val);
                setRegion('');
                setResults([]);
              }}
            >
              <SelectTrigger className="w-full mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Province / State</Label>
            <Select
              value={region}
              onValueChange={(val) => {
                setRegion(val);
                setResults([]);
              }}
            >
              <SelectTrigger className="w-full mt-1.5">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {regionOptions.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="city">City (optional)</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Calgary"
            className="mt-1.5"
          />
        </div>

        <Button
          onClick={handleSearch}
          disabled={searching || !region}
          className="w-full"
        >
          {searching ? 'Searching...' : 'Search Available Numbers'}
        </Button>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">{error}</div>
        )}

        {results.length > 0 && (
          <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
            {results.map((num) => (
              <div
                key={num.phoneNumber}
                className="flex items-center justify-between p-3 hover:bg-muted/50"
              >
                <div>
                  <p className="font-mono font-medium">
                    {formatPhoneNumber(num.phoneNumber)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {num.locality}
                    {num.locality && num.region ? ', ' : ''}
                    {num.region}
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
        )}
      </CardContent>
    </Card>
  );
}
