'use client';

import { useState, useEffect } from 'react';
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
import type { WizardData } from '../setup-wizard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Location data
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
// Component
// ---------------------------------------------------------------------------

export function StepPhoneNumber({ data, updateData, onNext, onBack }: Props) {
  // Shared state
  const [error, setError] = useState('');
  const [processingNumber, setProcessingNumber] = useState<string | null>(null);

  // "Your Numbers" tab state
  const [unassigned, setUnassigned] = useState<OwnedNumber[]>([]);
  const [loadingUnassigned, setLoadingUnassigned] = useState(true);

  // "Buy New Number" tab state
  const [country, setCountry] = useState('CA');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [searchResults, setSearchResults] = useState<AvailableNumber[]>([]);
  const [searching, setSearching] = useState(false);

  // Load unassigned numbers on mount
  useEffect(() => {
    async function loadUnassigned() {
      try {
        const res = await fetch('/api/admin/twilio/unassigned');
        const result = (await res.json()) as {
          numbers?: OwnedNumber[];
          error?: string;
        };

        if (res.ok && result.numbers) {
          setUnassigned(result.numbers);
        }
      } catch (err) {
        console.error('Failed to load unassigned numbers:', err);
      } finally {
        setLoadingUnassigned(false);
      }
    }

    loadUnassigned();
  }, []);

  // Assign an existing owned number to this client
  async function handleAssign(phoneNumber: string) {
    if (!data.clientId) {
      setError('Client not created yet. Please go back and complete Step 1.');
      return;
    }

    setProcessingNumber(phoneNumber);
    setError('');

    try {
      const res = await fetch('/api/admin/twilio/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, clientId: data.clientId }),
      });

      const result = (await res.json()) as { error?: string; success?: boolean };

      if (!res.ok) {
        setError(result.error || 'Failed to assign number');
        return;
      }

      updateData({ twilioNumber: phoneNumber });
      onNext();
    } catch (err) {
      console.error('Assign error:', err);
      setError('Failed to assign number. Check console for details.');
    } finally {
      setProcessingNumber(null);
    }
  }

  // Search for new numbers by location
  async function handleSearch() {
    if (!region) {
      setError('Please select a province or state');
      return;
    }

    setSearching(true);
    setError('');
    setSearchResults([]);

    try {
      const params = new URLSearchParams({ country, inRegion: region });
      if (city.trim()) {
        params.set('inLocality', city.trim());
      }

      const res = await fetch(`/api/admin/twilio/search?${params}`);
      const result = (await res.json()) as {
        error?: string;
        numbers?: AvailableNumber[];
        isDevelopmentMock?: boolean;
      };

      if (!res.ok) {
        setError(result.error || 'Failed to search numbers');
        return;
      }

      const found = result.numbers || [];
      setSearchResults(found);

      if (found.length === 0) {
        const regionName =
          PROVINCES[country]?.find((p) => p.code === region)?.name || region;
        setError(
          `No numbers found in ${regionName}${city ? `, ${city}` : ''}. Try a different location.`
        );
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search for numbers.');
    } finally {
      setSearching(false);
    }
  }

  // Purchase a new number and assign to client
  async function handlePurchase(phoneNumber: string) {
    if (!data.clientId) {
      setError('Client not created yet. Please go back and complete Step 1.');
      return;
    }

    setProcessingNumber(phoneNumber);
    setError('');

    try {
      const res = await fetch('/api/admin/twilio/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, clientId: data.clientId }),
      });

      const result = (await res.json()) as { error?: string; success?: boolean };

      if (!res.ok) {
        setError(result.error || 'Failed to purchase number');
        return;
      }

      updateData({ twilioNumber: phoneNumber });
      onNext();
    } catch (err) {
      console.error('Purchase error:', err);
      setError('Failed to purchase number. Check console for details.');
    } finally {
      setProcessingNumber(null);
    }
  }

  // If already has a number assigned, show it
  if (data.twilioNumber) {
    return (
      <div className="space-y-4">
        <div className="p-6 border rounded-lg text-center">
          <p className="text-sm text-muted-foreground mb-2">Assigned Number</p>
          <p className="text-3xl font-mono font-bold">
            {formatPhoneNumber(data.twilioNumber)}
          </p>
          <div className="flex justify-center gap-2 mt-3">
            <Badge variant="outline">Voice</Badge>
            <Badge variant="outline">SMS</Badge>
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext}>Next: Team Members</Button>
        </div>
      </div>
    );
  }

  const regionOptions = PROVINCES[country] || [];

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <Tabs defaultValue="existing">
        <TabsList className="w-full">
          <TabsTrigger value="existing" className="flex-1">
            Your Numbers
            {!loadingUnassigned && unassigned.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {unassigned.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="new" className="flex-1">
            Buy New Number
          </TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        {/* Tab 1: Existing unassigned numbers                               */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="existing" className="mt-4">
          {loadingUnassigned ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Loading your Twilio numbers...
            </div>
          ) : unassigned.length === 0 ? (
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
                {unassigned.length} unassigned{' '}
                {unassigned.length === 1 ? 'number' : 'numbers'} on your account:
              </p>
              <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
                {unassigned.map((num) => (
                  <div
                    key={num.sid}
                    className="flex items-center justify-between p-3 hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-mono font-medium">
                        {formatPhoneNumber(num.phoneNumber)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {num.friendlyName}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAssign(num.phoneNumber)}
                      disabled={processingNumber !== null}
                    >
                      {processingNumber === num.phoneNumber ? 'Assigning...' : 'Assign'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* Tab 2: Search & purchase new number                              */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="new" className="mt-4 space-y-4">
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
                  setSearchResults([]);
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
                      {num.locality}
                      {num.locality && num.region ? ', ' : ''}
                      {num.region}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handlePurchase(num.phoneNumber)}
                    disabled={processingNumber !== null}
                  >
                    {processingNumber === num.phoneNumber ? 'Purchasing...' : 'Purchase'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button variant="ghost" onClick={onNext}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}
