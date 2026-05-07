'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

interface CreateLeadDialogProps {
  onCreated: () => void;
}

// CASL §10(1): implied consent from inquiry expires after 6 calendar months.
const CASL_IMPLIED_CONSENT_DAYS = 180;
const MIN_EXPRESS_CONSENT_EVIDENCE_LENGTH = 10;

function todayISODate(): string {
  // YYYY-MM-DD in the user's local timezone — matches <input type="date"> format.
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function daysSince(isoDate: string): number {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function CreateLeadDialog({ onCreated }: CreateLeadDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const today = useMemo(todayISODate, []);
  const [inquiryDate, setInquiryDate] = useState(today);
  const [expressConsentEvidence, setExpressConsentEvidence] = useState('');

  const ageDays = daysSince(inquiryDate);
  const requiresExpressConsent = ageDays >= CASL_IMPLIED_CONSENT_DAYS;
  const evidenceValid =
    expressConsentEvidence.trim().length >= MIN_EXPRESS_CONSENT_EVIDENCE_LENGTH;
  const submitDisabled =
    saving || (requiresExpressConsent && !evidenceValid);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const form = new FormData(e.currentTarget);
    const body: Record<string, string> = {
      name: form.get('name') as string,
      phone: form.get('phone') as string,
      email: form.get('email') as string,
      projectType: form.get('projectType') as string,
      notes: form.get('notes') as string,
      inquiryDate,
    };
    if (requiresExpressConsent) {
      body.expressConsentEvidence = expressConsentEvidence.trim();
    }

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setOpen(false);
      setInquiryDate(today);
      setExpressConsentEvidence('');
      onCreated();
    } else {
      const data = await res.json() as { error?: string };
      setError(data.error || 'Failed to create lead');
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-8 px-3">
        <Plus className="h-4 w-4" />
        Add Lead
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required placeholder="John Smith" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input id="phone" name="phone" required placeholder="+1 (555) 123-4567" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="john@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="projectType">Project Type</Label>
            <Input id="projectType" name="projectType" placeholder="Kitchen remodel, plumbing repair..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inquiryDate">Inquiry date *</Label>
            <Input
              id="inquiryDate"
              name="inquiryDate"
              type="date"
              required
              max={today}
              value={inquiryDate}
              onChange={(e) => setInquiryDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              When did the homeowner first reach out? Required for CASL consent tracking.
            </p>
          </div>
          {requiresExpressConsent && (
            <div className="space-y-2 rounded-md border border-sienna bg-[#FFF3E0] p-3">
              <p className="text-sm font-medium text-sienna">
                This inquiry is over 6 months old. CASL requires documented express consent before we can contact this homeowner.
              </p>
              <Label htmlFor="expressConsentEvidence">
                How was express consent obtained? *
              </Label>
              <Textarea
                id="expressConsentEvidence"
                name="expressConsentEvidence"
                rows={3}
                required
                minLength={MIN_EXPRESS_CONSENT_EVIDENCE_LENGTH}
                placeholder="e.g., signed estimate request form on 2024-08-15"
                value={expressConsentEvidence}
                onChange={(e) => setExpressConsentEvidence(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Minimum {MIN_EXPRESS_CONSENT_EVIDENCE_LENGTH} characters. This is stored on the consent record as evidence.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} placeholder="Any additional context..." />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitDisabled}>
              {saving ? 'Creating...' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
