'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import type { WizardData } from '../setup-wizard';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepBusinessHours({ data, updateData, onNext, onBack }: Props) {
  function updateHours(dayIndex: number, field: 'openTime' | 'closeTime' | 'isOpen', value: string | boolean) {
    const newHours = [...data.businessHours];
    if (field === 'openTime' || field === 'closeTime') {
      newHours[dayIndex] = { ...newHours[dayIndex], [field]: value };
    } else {
      newHours[dayIndex] = { ...newHours[dayIndex], isOpen: value as boolean };
    }
    updateData({ businessHours: newHours });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Set your business hours. Calls outside these times will go to voicemail.
      </p>

      <div className="space-y-3">
        {data.businessHours.map((day, index) => (
          <Card key={day.dayOfWeek} className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="w-24">
                <p className="font-medium text-sm">{DAY_NAMES[day.dayOfWeek]}</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={day.isOpen}
                  onChange={(e) => updateHours(index, 'isOpen', e.target.checked)}
                  className="w-4 h-4"
                  id={`day-${index}`}
                />
                <Label htmlFor={`day-${index}`} className="text-sm cursor-pointer">
                  Open
                </Label>
              </div>

              {day.isOpen && (
                <>
                  <div className="flex-1">
                    <Label className="text-xs">Opens</Label>
                    <Input
                      type="time"
                      value={day.openTime}
                      onChange={(e) => updateHours(index, 'openTime', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div className="flex-1">
                    <Label className="text-xs">Closes</Label>
                    <Input
                      type="time"
                      value={day.closeTime}
                      onChange={(e) => updateHours(index, 'closeTime', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </>
              )}

              {!day.isOpen && (
                <div className="flex-1 text-sm text-muted-foreground">
                  Closed
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={onNext}>
          Next: Review & Launch →
        </Button>
      </div>
    </div>
  );
}
