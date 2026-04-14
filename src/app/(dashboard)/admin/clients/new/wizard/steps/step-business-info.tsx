'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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

    // Validate required business fields
    if (!data.businessName || !data.ownerName || !data.email || !data.phone) {
      setError('Please fill in all required fields');
      return;
    }

    // Email validation
    if (!data.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate ICP fields
    const leadVolume = data.estimatedLeadVolume ? Number(data.estimatedLeadVolume) : 0;
    const projectValue = data.averageProjectValue ? Number(data.averageProjectValue) : 0;
    const deadQuotes = data.deadQuoteCount ? Number(data.deadQuoteCount) : 0;

    if (!data.estimatedLeadVolume || leadVolume <= 0) {
      setError('Estimated monthly leads is required');
      return;
    }
    if (!data.averageProjectValue || projectValue <= 0) {
      setError('Average project value is required');
      return;
    }
    if (!data.deadQuoteCount || deadQuotes <= 0) {
      setError('Dead quotes available is required');
      return;
    }

    // Low volume disclosure gate
    if (leadVolume < 15 && !data.lowVolumeDisclosureAcknowledged) {
      setError('You must confirm you disclosed the low lead volume to the contractor before continuing');
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
          estimatedLeadVolume: data.estimatedLeadVolume ? Number(data.estimatedLeadVolume) : undefined,
          averageProjectValue: data.averageProjectValue ? Number(data.averageProjectValue) : undefined,
          deadQuoteCount: data.deadQuoteCount ? Number(data.deadQuoteCount) : undefined,
          lowVolumeDisclosureAcknowledged: data.lowVolumeDisclosureAcknowledged,
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
        <div className="p-3 text-sm text-destructive bg-[#FDEAE4] rounded-lg">
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
            placeholder="ABC Services Ltd."
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
            placeholder="john@abcservices.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Owner&apos;s Phone *</Label>
          <Input
            id="phone"
            type="tel"
            value={data.phone}
            onChange={(e) => updateData({ phone: e.target.value })}
            placeholder="403-555-1234"
          />
          <p className="text-xs text-muted-foreground">
            The owner&apos;s personal or business cell. Used for escalation alerts and account notifications &mdash; not shared with leads.
          </p>
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
          <Label htmlFor="googleBusinessUrl">Google Review URL</Label>
          <Input
            id="googleBusinessUrl"
            type="url"
            value={data.googleBusinessUrl}
            onChange={(e) => updateData({ googleBusinessUrl: e.target.value })}
            placeholder="https://g.page/r/XXXXX/review"
          />
          <p className="text-xs text-muted-foreground">
            Go to{' '}
            <a
              href="https://business.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-[#D4754A] hover:text-[#C15B2E]"
            >
              business.google.com
            </a>
            {' '}&rarr; Home &rarr; &quot;Get more reviews&quot; &rarr; copy the share link.
            It should look like <span className="font-mono">g.page/r/.../review</span>
          </p>
        </div>
      </div>

      {/* Lead Volume & Pipeline */}
      <div className="space-y-4 pt-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Lead Volume &amp; Pipeline</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Used to set realistic expectations and configure guarantee windows.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="estimatedLeadVolume">Estimated Monthly Leads *</Label>
            <Input
              id="estimatedLeadVolume"
              type="number"
              min="1"
              value={data.estimatedLeadVolume}
              onChange={(e) => updateData({ estimatedLeadVolume: e.target.value })}
              placeholder="e.g. 25"
            />
            <p className="text-xs text-muted-foreground">
              Inbound leads per month (calls, texts, form submissions)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="averageProjectValue">Average Project Value ($) *</Label>
            <Input
              id="averageProjectValue"
              type="number"
              min="1"
              value={data.averageProjectValue}
              onChange={(e) => updateData({ averageProjectValue: e.target.value })}
              placeholder="e.g. 5000"
            />
            <p className="text-xs text-muted-foreground">
              Typical job value in dollars
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadQuoteCount">Dead Quotes Available *</Label>
            <Input
              id="deadQuoteCount"
              type="number"
              min="1"
              value={data.deadQuoteCount}
              onChange={(e) => updateData({ deadQuoteCount: e.target.value })}
              placeholder="e.g. 10"
            />
            <p className="text-xs text-muted-foreground">
              Quotes sent in last 6 months that never closed
            </p>
          </div>
        </div>

        {/* Low volume warning */}
        {data.estimatedLeadVolume && Number(data.estimatedLeadVolume) > 0 && Number(data.estimatedLeadVolume) < 15 && (
          <div
            className="rounded-md p-4 space-y-3"
            style={{
              borderLeft: '4px solid #C15B2E',
              backgroundColor: '#FFF3E0',
            }}
          >
            <p className="text-sm" style={{ color: '#6B7E54' }}>
              Low lead volume detected. Guarantee windows may be extended for this client.
              Confirm you disclosed this to the contractor.
            </p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="lowVolumeDisclosureAcknowledged"
                checked={data.lowVolumeDisclosureAcknowledged}
                onCheckedChange={(checked) =>
                  updateData({ lowVolumeDisclosureAcknowledged: checked === true })
                }
              />
              <Label
                htmlFor="lowVolumeDisclosureAcknowledged"
                className="text-sm font-normal cursor-pointer"
                style={{ color: '#6B7E54' }}
              >
                I disclosed the low lead volume to the contractor
              </Label>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleNext} disabled={loading}>
          {loading ? 'Creating...' : 'Next: Phone Number →'}
        </Button>
      </div>
    </div>
  );
}
