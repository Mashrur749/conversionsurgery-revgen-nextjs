'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { WizardData } from '../setup-wizard';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepBusinessHours({ data, updateData, onNext, onBack }: Props) {
  const [error, setError] = useState('');

  function updateHour(dayOfWeek: number, field: string, value: any) {
    const newHours = data.businessHours.map(h =>
      h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h
    );
    updateData({ businessHours: newHours });
  }

  async function handleNext() {
    // Save business hours if we have a client
    if (data.clientId) {
      await fetch('/api/business-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: data.clientId,
          hours: data.businessHours,
        }),
      });
    }

    onNext();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Set your business hours. During these times, high-intent leads will trigger
        hot transfers where all team phones ring simultaneously.
      </p>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {data.businessHours.map((hour) => (
          <div key={hour.dayOfWeek} className="flex items-center gap-4">
            <div className="w-28">
              <Label>{DAYS[hour.dayOfWeek]}</Label>
            </div>
            <Switch
              checked={hour.isOpen}
              onCheckedChange={(checked) => updateHour(hour.dayOfWeek, 'isOpen', checked)}
            />
            {hour.isOpen ? (
              <>
                <Input
                  type="time"
                  value={hour.openTime}
                  onChange={(e) => updateHour(hour.dayOfWeek, 'openTime', e.target.value)}
                  className="w-32"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="time"
                  value={hour.closeTime}
                  onChange={(e) => updateHour(hour.dayOfWeek, 'closeTime', e.target.value)}
                  className="w-32"
                />
              </>
            ) : (
              <span className="text-muted-foreground">Closed</span>
            )}
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Outside business hours, leads will still receive AI responses and escalations
        will be queued for the next business day.
      </p>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={handleNext}>
          Next: Review →
        </Button>
      </div>
    </div>
  );
}
