'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WizardData } from '../setup-wizard';

const TIMEZONES = [
  { value: 'America/Vancouver', label: 'Pacific (Vancouver)' },
  { value: 'America/Edmonton', label: 'Mountain (Edmonton/Calgary)' },
  { value: 'America/Winnipeg', label: 'Central (Winnipeg)' },
  { value: 'America/Toronto', label: 'Eastern (Toronto)' },
  { value: 'America/Halifax', label: 'Atlantic (Halifax)' },
];

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  onNext: () => void;
}

export function StepBusinessInfo({ data, updateData, onNext }: Props) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleNext() {
    setError('');

    // Validate
    if (!data.businessName || !data.ownerName || !data.email || !data.phone) {
      setError('Please fill in all required fields');
      return;
    }

    // Email validation
    if (!data.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      // Create the client
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: data.businessName,
          ownerName: data.ownerName,
          email: data.email,
          phone: data.phone,
          timezone: data.timezone,
          googleBusinessUrl: data.googleBusinessUrl,
        }),
      });

      const result = (await res.json()) as { error?: string; client?: { id: string } };

      if (!res.ok) {
        setError(result.error || 'Failed to create client');
        return;
      }

      // Save the client ID
      updateData({ clientId: result.client?.id });
      onNext();
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="businessName">Business Name *</Label>
          <Input
            id="businessName"
            value={data.businessName}
            onChange={(e) => updateData({ businessName: e.target.value })}
            placeholder="ABC Roofing Ltd."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ownerName">Owner Name *</Label>
          <Input
            id="ownerName"
            value={data.ownerName}
            onChange={(e) => updateData({ ownerName: e.target.value })}
            placeholder="John Smith"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={data.email}
            onChange={(e) => updateData({ email: e.target.value })}
            placeholder="john@abcroofing.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            type="tel"
            value={data.phone}
            onChange={(e) => updateData({ phone: e.target.value })}
            placeholder="403-555-1234"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Select
            value={data.timezone}
            onValueChange={(value) => updateData({ timezone: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="googleBusinessUrl">Google Business URL</Label>
          <Input
            id="googleBusinessUrl"
            type="url"
            value={data.googleBusinessUrl}
            onChange={(e) => updateData({ googleBusinessUrl: e.target.value })}
            placeholder="https://g.page/abc-roofing"
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleNext} disabled={loading}>
          {loading ? 'Creating...' : 'Next: Phone Number →'}
        </Button>
      </div>
    </div>
  );
}
