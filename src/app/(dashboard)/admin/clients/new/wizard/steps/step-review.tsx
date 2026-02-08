'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPhoneNumber } from '@/lib/utils/phone';
import type { WizardData } from '../setup-wizard';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Props {
  data: WizardData;
  onBack: () => void;
  onComplete: () => void;
}

export function StepReview({ data, onBack, onComplete }: Props) {
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');

  async function handleComplete() {
    setCompleting(true);
    setError('');

    try {
      // Save team members if any
      if (data.teamMembers.length > 0 && data.clientId) {
        const res = await fetch('/api/admin/clients', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: data.clientId,
            teamMembers: data.teamMembers,
          }),
        });

        const result = (await res.json()) as { error?: string };

        if (!res.ok) {
          setError(result.error || 'Failed to save team members');
          return;
        }
      }

      onComplete();
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      {/* Business Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Business Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Business Name:</span>
            <span className="font-medium">{data.businessName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Owner:</span>
            <span className="font-medium">{data.ownerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email:</span>
            <span className="font-medium">{data.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Phone:</span>
            <span className="font-medium">{data.phone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Timezone:</span>
            <span className="font-medium">{data.timezone}</span>
          </div>
        </CardContent>
      </Card>

      {/* Phone Number */}
      {data.twilioNumber && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Phone Number</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-3xl font-mono font-bold">
              {formatPhoneNumber(data.twilioNumber)}
            </p>
            <div className="flex justify-center gap-2 mt-3">
              <Badge variant="outline">Voice</Badge>
              <Badge variant="outline">SMS</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Members */}
      {data.teamMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Team Members ({data.teamMembers.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.teamMembers.map((member, index) => (
              <div key={index} className="p-2 bg-gray-50 rounded">
                <p className="font-medium">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
                <p className="text-xs text-muted-foreground">{member.phone}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Business Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Business Hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {data.businessHours.map((day) => (
            <div key={day.dayOfWeek} className="flex justify-between">
              <span className="text-muted-foreground">{DAY_NAMES[day.dayOfWeek]}:</span>
              <span className="font-medium">
                {day.isOpen ? `${day.openTime} - ${day.closeTime}` : 'Closed'}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={handleComplete} disabled={completing}>
          {completing ? 'Launching...' : 'Launch Client →'}
        </Button>
      </div>
    </div>
  );
}
