'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ValueSummary {
  monthsActive: number;
  totalLeads: number;
  totalMessages: number;
  estimatedRevenue: number;
  monthlyCost: number;
  roi: number;
}

interface Props {
  clientId: string;
  valueSummary: ValueSummary;
}

const REASONS = [
  { value: 'too_expensive', label: "It's too expensive" },
  { value: 'not_using', label: "I'm not using it enough" },
  { value: 'switching_competitor', label: 'Switching to a competitor' },
  { value: 'business_closing', label: 'Business is closing/slowing' },
  { value: 'missing_features', label: 'Missing features I need' },
  { value: 'poor_results', label: 'Not seeing results' },
  { value: 'other', label: 'Other reason' },
];

export function CancellationFlow({ clientId, valueSummary }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  async function handleScheduleCall() {
    setSubmitting(true);
    await fetch('/api/client/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, feedback, action: 'schedule_call' }),
    });
    router.push('/client/cancel/call-scheduled');
  }

  async function handleConfirmCancel() {
    setSubmitting(true);
    await fetch('/api/client/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, feedback, action: 'confirm' }),
    });
    router.push('/client/cancel/confirmed');
  }

  if (step === 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Help Us Understand</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={reason} onValueChange={setReason}>
            {REASONS.map((r) => (
              <div key={r.value} className="flex items-center space-x-2">
                <RadioGroupItem value={r.value} id={r.value} />
                <Label htmlFor={r.value}>{r.label}</Label>
              </div>
            ))}
          </RadioGroup>

          <div className="space-y-2">
            <Label>Additional feedback (optional)</Label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What could we have done better?"
              rows={3}
            />
          </div>

          <Button
            onClick={() => setStep(2)}
            disabled={!reason}
            className="w-full"
          >
            Continue
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Before You Go...</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Would you like to schedule a quick call? We might be able to help with:
        </p>

        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          {reason === 'too_expensive' && (
            <li>Discuss pricing options or a temporary discount</li>
          )}
          {reason === 'not_using' && (
            <li>Show you features you might not know about</li>
          )}
          {reason === 'missing_features' && (
            <li>Share our roadmap or find workarounds</li>
          )}
          {reason === 'poor_results' && (
            <li>Review your setup and optimize for better results</li>
          )}
          <li>Answer any questions before you decide</li>
        </ul>

        <div className="grid grid-cols-2 gap-3 pt-4">
          <Button onClick={handleScheduleCall} disabled={submitting}>
            Schedule a Call
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowConfirmCancel(true)}
            disabled={submitting}
          >
            Cancel Anyway
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          If you cancel, you&apos;ll have 7 days to reactivate before losing your data
        </p>
      </CardContent>

      <AlertDialog open={showConfirmCancel} onOpenChange={setShowConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Cancellation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your subscription? You&apos;ll have 7 days to reactivate before your data is removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmCancel} disabled={submitting}>
              {submitting ? 'Cancelling...' : 'Yes, Cancel My Subscription'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
