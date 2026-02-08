'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPhoneNumber } from '@/lib/utils/phone';
import type { WizardData } from '../setup-wizard';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  data: WizardData;
  onBack: () => void;
  onComplete: () => void;
}

export function StepReview({ data, onBack, onComplete }: Props) {
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');

  async function handleActivate() {
    if (!data.clientId) {
      setError('Client not created');
      return;
    }

    setActivating(true);
    setError('');

    try {
      // Activate the client
      const res = await fetch(`/api/admin/clients/${data.clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });

      const result = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(result.error || 'Failed to activate');
        return;
      }

      onComplete();
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setActivating(false);
    }
  }

  const openDays = data.businessHours.filter(h => h.isOpen);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Review the setup and activate the client when ready.
      </p>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      {/* Business Info */}
      <div className="border rounded-lg p-4">
        <h3 className="font-medium mb-3">Business Information</h3>
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Business Name</span>
            <span className="font-medium">{data.businessName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Owner</span>
            <span>{data.ownerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{data.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Phone</span>
            <span>{data.phone}</span>
          </div>
        </div>
      </div>

      {/* Phone Number */}
      <div className="border rounded-lg p-4">
        <h3 className="font-medium mb-3">Twilio Number</h3>
        {data.twilioNumber ? (
          <div className="flex items-center justify-between">
            <span className="font-mono text-lg">
              {formatPhoneNumber(data.twilioNumber)}
            </span>
            <Badge className="bg-green-100 text-green-800">Configured</Badge>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">No number assigned</span>
            <Badge variant="outline" className="text-amber-600">Pending</Badge>
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className="border rounded-lg p-4">
        <h3 className="font-medium mb-3">Team Members</h3>
        {data.teamMembers.length > 0 ? (
          <div className="space-y-2">
            {data.teamMembers.map((member, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{member.name}</span>
                <span className="text-muted-foreground">{member.phone}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No team members added (escalations go to owner only)
          </p>
        )}
      </div>

      {/* Business Hours */}
      <div className="border rounded-lg p-4">
        <h3 className="font-medium mb-3">Business Hours</h3>
        {openDays.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {openDays.map((h) => (
              <Badge key={h.dayOfWeek} variant="outline">
                {DAYS[h.dayOfWeek]} {h.openTime}-{h.closeTime}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No business hours set (hot transfers disabled)
          </p>
        )}
      </div>

      {/* Warnings */}
      {(!data.twilioNumber || data.teamMembers.length === 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-medium text-amber-800 mb-2">Before you go live:</h4>
          <ul className="text-sm text-amber-700 space-y-1">
            {!data.twilioNumber && (
              <li>• Assign a phone number to receive calls and texts</li>
            )}
            {data.teamMembers.length === 0 && (
              <li>• Add team members to share escalation load</li>
            )}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button
          onClick={handleActivate}
          disabled={activating || !data.twilioNumber}
          className="min-w-32"
        >
          {activating ? 'Activating...' : '🚀 Activate Client'}
        </Button>
      </div>
    </div>
  );
}
