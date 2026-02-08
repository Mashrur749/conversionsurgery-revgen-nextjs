'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatPhoneNumber } from '@/lib/utils/phone';
import type { WizardData } from '../setup-wizard';

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
}

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepPhoneNumber({ data, updateData, onNext, onBack }: Props) {
  const [areaCode, setAreaCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
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
      const result = (await res.json()) as { error?: string; numbers?: AvailableNumber[] };

      if (!res.ok) {
        setError(result.error || 'Failed to search');
        return;
      }

      setNumbers(result.numbers || []);

      if ((result.numbers?.length || 0) === 0) {
        setError('No numbers found. Try a different area code.');
      }
    } finally {
      setSearching(false);
    }
  }

  async function handlePurchase(phoneNumber: string) {
    if (!data.clientId) {
      setError('Client not created yet');
      return;
    }

    setPurchasing(true);
    setError('');

    try {
      const res = await fetch('/api/admin/twilio/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          clientId: data.clientId,
        }),
      });

      const result = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(result.error || 'Failed to purchase');
        return;
      }

      updateData({ twilioNumber: phoneNumber });
      onNext();
    } finally {
      setPurchasing(false);
    }
  }

  // If already has number, show it
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
            ← Back
          </Button>
          <Button onClick={onNext}>
            Next: Team Members →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="areaCode">Search by Area Code</Label>
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

      {numbers.length > 0 && (
        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
          {numbers.map((num) => (
            <div
              key={num.phoneNumber}
              className="flex items-center justify-between p-3 hover:bg-gray-50"
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
                disabled={purchasing}
              >
                {purchasing ? 'Purchasing...' : 'Select'}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button variant="ghost" onClick={onNext}>
          Skip for now →
        </Button>
      </div>
    </div>
  );
}
