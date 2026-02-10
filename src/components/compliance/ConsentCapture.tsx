'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConsentCaptureProps {
  phoneNumber: string;
  businessName: string;
  onConsent: (consent: {
    scope: {
      marketing: boolean;
      transactional: boolean;
      promotional: boolean;
      reminders: boolean;
    };
  }) => Promise<void>;
}

export function ConsentCapture({
  phoneNumber,
  businessName,
  onConsent,
}: ConsentCaptureProps) {
  const [marketing, setMarketing] = useState(true);
  const [transactional, setTransactional] = useState(true);
  const [promotional, setPromotional] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onConsent({
        scope: { marketing, transactional, promotional, reminders },
      });
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Alert>
        <AlertDescription>
          Thank you! Your communication preferences have been saved.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Communication Preferences</CardTitle>
        <CardDescription>
          Select how you&apos;d like to receive messages from {businessName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Phone number: {phoneNumber}
        </p>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="marketing"
              checked={marketing}
              onCheckedChange={(checked) => setMarketing(!!checked)}
            />
            <Label htmlFor="marketing">
              Marketing messages (promotions, offers)
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="transactional"
              checked={transactional}
              onCheckedChange={(checked) => setTransactional(!!checked)}
            />
            <Label htmlFor="transactional">
              Transactional messages (order updates, confirmations)
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="promotional"
              checked={promotional}
              onCheckedChange={(checked) => setPromotional(!!checked)}
            />
            <Label htmlFor="promotional">
              Special offers and discounts
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="reminders"
              checked={reminders}
              onCheckedChange={(checked) => setReminders(!!checked)}
            />
            <Label htmlFor="reminders">Appointment reminders</Label>
          </div>
        </div>

        <div className="text-xs text-muted-foreground p-3 bg-muted rounded-md">
          By clicking &quot;Save Preferences&quot;, you consent to receive
          automated text messages from {businessName} at the phone number
          provided. Message and data rates may apply. Message frequency varies.
          Reply STOP to unsubscribe at any time.
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? 'Saving...' : 'Save Preferences'}
        </Button>
      </CardContent>
    </Card>
  );
}
