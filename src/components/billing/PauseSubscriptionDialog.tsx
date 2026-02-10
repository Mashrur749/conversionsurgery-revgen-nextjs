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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addMonths, format } from 'date-fns';

interface PauseSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (resumeDate: Date) => Promise<void>;
}

export function PauseSubscriptionDialog({
  open,
  onOpenChange,
  onConfirm,
}: PauseSubscriptionDialogProps) {
  const [pauseDuration, setPauseDuration] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resumeDate = addMonths(new Date(), parseInt(pauseDuration));

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(resumeDate);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pause Subscription</DialogTitle>
          <DialogDescription>
            Take a break without losing your data. Your subscription will automatically
            resume on the selected date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Pause duration</Label>
            <Select value={pauseDuration} onValueChange={setPauseDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 month</SelectItem>
                <SelectItem value="2">2 months</SelectItem>
                <SelectItem value="3">3 months</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            <p><strong>What happens when paused:</strong></p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>No charges during pause period</li>
              <li>Automated flows will stop</li>
              <li>All your data is preserved</li>
              <li>Resumes automatically on {format(resumeDate, 'MMMM d, yyyy')}</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Pausing...' : 'Pause Subscription'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
