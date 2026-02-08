'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

interface Lead {
  id: string;
  status: string | null;
  actionRequired: boolean | null;
}

interface Props {
  lead: Lead;
}

export function ActionButtons({ lead }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [showAppointment, setShowAppointment] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');

  async function startSequence(type: string, data: Record<string, any> = {}) {
    setLoading(type);
    try {
      const res = await fetch(`/api/sequences/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, ...data }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        alert('Failed to start sequence');
      }
    } finally {
      setLoading(null);
    }
  }

  async function cancelSequence(sequenceType: string) {
    setLoading(`cancel-${sequenceType}`);
    try {
      const res = await fetch('/api/sequences/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, sequenceType }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        alert('Failed to cancel sequence');
      }
    } finally {
      setLoading(null);
    }
  }

  async function clearActionRequired() {
    setLoading('clear');
    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionRequired: false }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {lead.actionRequired && (
          <Button
            variant="outline"
            className="w-full"
            onClick={clearActionRequired}
            disabled={loading === 'clear'}
          >
            {loading === 'clear' ? 'Clearing...' : '✓ Mark Resolved'}
          </Button>
        )}

        {!showAppointment ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowAppointment(true)}
          >
            📅 Schedule Appointment
          </Button>
        ) : (
          <div className="space-y-2 p-3 border rounded-lg">
            <Label>Date</Label>
            <Input
              type="date"
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
            />
            <Label>Time</Label>
            <Input
              type="time"
              value={appointmentTime}
              onChange={(e) => setAppointmentTime(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  startSequence('appointment', {
                    date: appointmentDate,
                    time: appointmentTime,
                  });
                  setShowAppointment(false);
                }}
                disabled={!appointmentDate || !appointmentTime || loading === 'appointment'}
              >
                {loading === 'appointment' ? 'Scheduling...' : 'Confirm'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAppointment(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <Button
          variant="outline"
          className="w-full"
          onClick={() => startSequence('estimate')}
          disabled={loading === 'estimate'}
        >
          {loading === 'estimate' ? 'Starting...' : '💰 Start Estimate Follow-up'}
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => startSequence('review')}
          disabled={loading === 'review'}
        >
          {loading === 'review' ? 'Starting...' : '⭐ Request Review'}
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => startSequence('payment')}
          disabled={loading === 'payment'}
        >
          {loading === 'payment' ? 'Starting...' : '💳 Start Payment Reminder'}
        </Button>

        <div className="border-t pt-3 mt-3">
          <p className="text-xs text-muted-foreground mb-2">Cancel Sequences</p>
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => cancelSequence('appointment')}
              disabled={loading === 'cancel-appointment'}
            >
              {loading === 'cancel-appointment' ? 'Cancelling...' : '❌ Cancel Appointment'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => cancelSequence('estimate')}
              disabled={loading === 'cancel-estimate'}
            >
              {loading === 'cancel-estimate' ? 'Cancelling...' : '❌ Cancel Estimate'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => cancelSequence('review')}
              disabled={loading === 'cancel-review'}
            >
              {loading === 'cancel-review' ? 'Cancelling...' : '❌ Cancel Review'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => cancelSequence('payment')}
              disabled={loading === 'cancel-payment'}
            >
              {loading === 'cancel-payment' ? 'Cancelling...' : '❌ Cancel Payment'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
