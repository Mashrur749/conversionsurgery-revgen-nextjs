'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';

interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
  endDate: Date;
}

const CANCELLATION_REASONS = [
  { value: 'too_expensive', label: 'Too expensive for my budget' },
  { value: 'not_using', label: "Not using the service enough" },
  { value: 'missing_features', label: "Missing features I need" },
  { value: 'found_alternative', label: 'Found a better alternative' },
  { value: 'business_closed', label: 'Closing my business' },
  { value: 'temporary', label: 'Just need a break (temporary)' },
  { value: 'other', label: 'Other reason' },
];

export function CancelSubscriptionDialog({
  open,
  onOpenChange,
  onConfirm,
  endDate,
}: CancelSubscriptionDialogProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    const reason = selectedReason === 'other' ? otherReason : selectedReason;
    if (!reason) return;

    setIsSubmitting(true);
    try {
      await onConfirm(reason);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Subscription</DialogTitle>
          <DialogDescription>
            We&apos;re sorry to see you go. Your subscription will remain active until{' '}
            <strong>{format(endDate, 'MMMM d, yyyy')}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-accent p-3 text-sm text-forest">
            <strong>Before you cancel:</strong> Would a pause work better? You can pause
            for up to 3 months and keep your data intact.
          </div>

          <div className="space-y-2">
            <Label>Please tell us why you&apos;re leaving</Label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {CANCELLATION_REASONS.map((reason) => (
                <div key={reason.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={reason.value} id={reason.value} />
                  <Label htmlFor={reason.value} className="font-normal">
                    {reason.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {selectedReason === 'other' && (
            <Textarea
              placeholder="Please tell us more..."
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep Subscription
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!selectedReason || (selectedReason === 'other' && !otherReason) || isSubmitting}
          >
            {isSubmitting ? 'Canceling...' : 'Confirm Cancellation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
