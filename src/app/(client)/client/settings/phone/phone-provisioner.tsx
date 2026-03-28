'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, CheckCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatPhoneNumber } from '@/lib/utils/phone';

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
}

interface PhoneProvisionerProps {
  currentNumber: string | null;
  businessName: string;
}

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
    { code: 'ON', name: 'Ontario' },
    { code: 'PE', name: 'Prince Edward Island' },
    { code: 'QC', name: 'Quebec' },
    { code: 'SK', name: 'Saskatchewan' },
  ],
  US: [
    { code: 'AL', name: 'Alabama' },
    { code: 'AK', name: 'Alaska' },
    { code: 'AZ', name: 'Arizona' },
    { code: 'CA', name: 'California' },
    { code: 'CO', name: 'Colorado' },
    { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' },
    { code: 'IL', name: 'Illinois' },
    { code: 'NY', name: 'New York' },
    { code: 'OH', name: 'Ohio' },
    { code: 'PA', name: 'Pennsylvania' },
    { code: 'TX', name: 'Texas' },
    { code: 'WA', name: 'Washington' },
  ],
};

export function PhoneProvisioner({ currentNumber, businessName }: PhoneProvisionerProps) {
  const router = useRouter();
  const [country, setCountry] = useState('CA');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [searchResults, setSearchResults] = useState<AvailableNumber[]>([]);
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchasedNumber, setPurchasedNumber] = useState<string | null>(null);

  // Already has a number — show it
  if (currentNumber && !purchasedNumber) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-[#3D7A50]" />
            Active Business Line
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-mono font-bold">{formatPhoneNumber(currentNumber)}</p>
          <div className="flex gap-2 mt-3">
            <Badge variant="outline">Voice</Badge>
            <Badge variant="outline">SMS</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            This number receives all inbound calls and texts for {businessName}.
            AI responses, follow-ups, and notifications are sent from this number.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Just purchased — show success with the number
  if (purchasedNumber) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F5E9]">
            <CheckCircle className="h-8 w-8 text-[#3D7A50]" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Phone Number Activated!</h2>
            <p className="text-2xl font-mono font-bold mt-2">{formatPhoneNumber(purchasedNumber)}</p>
            <p className="text-muted-foreground mt-2">
              Your business line is live. All automated texts, AI responses,
              and voice calls for {businessName} will use this number.
            </p>
          </div>
          <Button onClick={() => router.push('/client')}>Go to Dashboard</Button>
        </CardContent>
      </Card>
    );
  }

  // No number — show provisioning flow
  const regionOptions = PROVINCES[country] || [];

  async function handleSearch() {
    if (!region) {
      setError('Please select a province or state');
      return;
    }

    setSearching(true);
    setError(null);
    setSearchResults([]);

    try {
      const params = new URLSearchParams({ country, inRegion: region });
      if (city.trim()) params.set('inLocality', city.trim());

      const res = await fetch(`/api/client/phone-numbers/search?${params}`);
      const data: { numbers?: AvailableNumber[]; error?: string } = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to search numbers');
        return;
      }

      const found = data.numbers || [];
      setSearchResults(found);

      if (found.length === 0) {
        const regionName = regionOptions.find((p) => p.code === region)?.name || region;
        setError(`No numbers found in ${regionName}${city ? `, ${city}` : ''}. Try a different location.`);
      }
    } catch (err) {
      console.error('[PhoneProvisioner] Search failed:', err);
      setError('Failed to search. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  async function handlePurchase(phoneNumber: string) {
    setPurchasing(phoneNumber);
    setError(null);

    try {
      const res = await fetch('/api/client/phone-numbers/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      const data: { error?: string; success?: boolean } = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to purchase number');
        return;
      }

      setPurchasedNumber(phoneNumber);
      router.refresh();
    } catch (err) {
      console.error('[PhoneProvisioner] Purchase failed:', err);
      setError('Failed to purchase number. Please try again.');
    } finally {
      setPurchasing(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Up Your Business Line</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose a local phone number for your business. All automated texts, AI responses,
          and voice calls will use this number.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-sienna bg-[#FDEAE4] rounded-md" role="alert">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Country</Label>
            <Select
              value={country}
              onValueChange={(val) => {
                setCountry(val);
                setRegion('');
                setSearchResults([]);
              }}
            >
              <SelectTrigger className="w-full mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
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
                setSearchResults([]);
              }}
            >
              <SelectTrigger className="w-full mt-1.5">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {regionOptions.map((r) => (
                  <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
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

        <Button onClick={handleSearch} disabled={searching || !region} className="w-full">
          <Search className="h-4 w-4 mr-1" />
          {searching ? 'Searching...' : 'Search Available Numbers'}
        </Button>

        {searchResults.length > 0 && (
          <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
            {searchResults.map((num) => (
              <div
                key={num.phoneNumber}
                className="flex items-center justify-between p-3 hover:bg-muted/50"
              >
                <div>
                  <p className="font-mono font-medium">
                    {formatPhoneNumber(num.phoneNumber)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {num.locality}{num.locality && num.region ? ', ' : ''}{num.region}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handlePurchase(num.phoneNumber)}
                  disabled={purchasing !== null}
                >
                  {purchasing === num.phoneNumber ? 'Setting up...' : 'Purchase'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
