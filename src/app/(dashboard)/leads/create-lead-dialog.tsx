'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
// CASL §10(10)(a): existing-customer relationship grants implied consent for 24 months.
const CASL_EXISTING_CUSTOMER_DAYS = 730;
const MIN_EXPRESS_CONSENT_EVIDENCE_LENGTH = 10;

type ConsentMode = 'inquiry' | 'express_consent' | 'existing_customer';

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
  const [consentMode, setConsentMode] = useState<ConsentMode>('inquiry');
  const [inquiryDate, setInquiryDate] = useState(today);
  const [expressConsentEvidence, setExpressConsentEvidence] = useState('');
  const [transactionDate, setTransactionDate] = useState(today);
  const [customerNotes, setCustomerNotes] = useState('');

  const inquiryAgeDays = daysSince(inquiryDate);
  const transactionAgeDays = daysSince(transactionDate);
  const evidenceValid =
    expressConsentEvidence.trim().length >= MIN_EXPRESS_CONSENT_EVIDENCE_LENGTH;
  const transactionWithinWindow =
    transactionAgeDays >= 0 && transactionAgeDays <= CASL_EXISTING_CUSTOMER_DAYS;
  // Auto-prompt when an "inquiry" mode date crosses the 6-month boundary.
  const inquiryRequiresExpressConsent =
    consentMode === 'inquiry' && inquiryAgeDays >= CASL_IMPLIED_CONSENT_DAYS;

  let submitDisabled = saving;
  if (consentMode === 'inquiry' && inquiryRequiresExpressConsent) {
    submitDisabled = true;
  }
  if (consentMode === 'express_consent' && !evidenceValid) {
    submitDisabled = true;
  }
  if (consentMode === 'existing_customer' && !transactionWithinWindow) {
    submitDisabled = true;
  }

  function resetForm() {
    setConsentMode('inquiry');
    setInquiryDate(today);
    setExpressConsentEvidence('');
    setTransactionDate(today);
    setCustomerNotes('');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const form = new FormData(e.currentTarget);
    const sharedFields = {
      name: form.get('name') as string,
      phone: form.get('phone') as string,
      email: form.get('email') as string,
      projectType: form.get('projectType') as string,
      notes: form.get('notes') as string,
    };

    let body: Record<string, string>;
    if (consentMode === 'existing_customer') {
      body = {
        ...sharedFields,
        consentMode,
        transactionDate,
      };
      const trimmedCustomerNotes = customerNotes.trim();
      if (trimmedCustomerNotes) {
        body.customerNotes = trimmedCustomerNotes;
      }
    } else if (consentMode === 'express_consent') {
      body = {
        ...sharedFields,
        consentMode,
        inquiryDate,
        expressConsentEvidence: expressConsentEvidence.trim(),
      };
    } else {
      body = {
        ...sharedFields,
        consentMode,
        inquiryDate,
      };
    }

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setOpen(false);
      resetForm();
      onCreated();
    } else {
      const data = (await res.json()) as { error?: string };
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
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Consent basis *</legend>
            <RadioGroup
              value={consentMode}
              onValueChange={(v) => setConsentMode(v as ConsentMode)}
              className="gap-2"
            >
              <label className="flex items-start gap-2 rounded-md border border-input p-2 cursor-pointer hover:bg-muted/30">
                <RadioGroupItem value="inquiry" id="consent-inquiry" className="mt-1" />
                <div className="text-sm">
                  <p className="font-medium">New inquiry (last 6 months)</p>
                  <p className="text-xs text-muted-foreground">
                    Homeowner reached out within the last 180 days.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-2 rounded-md border border-input p-2 cursor-pointer hover:bg-muted/30">
                <RadioGroupItem
                  value="express_consent"
                  id="consent-express"
                  className="mt-1"
                />
                <div className="text-sm">
                  <p className="font-medium">Older inquiry (express consent on file)</p>
                  <p className="text-xs text-muted-foreground">
                    Older lead with documented written or recorded consent.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-2 rounded-md border border-input p-2 cursor-pointer hover:bg-muted/30">
                <RadioGroupItem
                  value="existing_customer"
                  id="consent-customer"
                  className="mt-1"
                />
                <div className="text-sm">
                  <p className="font-medium">Past paid customer (within 24 months)</p>
                  <p className="text-xs text-muted-foreground">
                    CASL §10(10)(a) allows outbound for 24 months from the transaction.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </fieldset>

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

          {(consentMode === 'inquiry' || consentMode === 'express_consent') && (
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
          )}

          {consentMode === 'inquiry' && inquiryRequiresExpressConsent && (
            <div className="space-y-2 rounded-md border border-sienna bg-[#FFF3E0] p-3">
              <p className="text-sm font-medium text-sienna">
                This inquiry is over 6 months old. Switch to &ldquo;Older inquiry&rdquo; mode and
                provide express-consent evidence, or use &ldquo;Past paid customer&rdquo; if this is a
                prior paid customer.
              </p>
            </div>
          )}

          {consentMode === 'express_consent' && (
            <div className="space-y-2 rounded-md border border-sienna bg-[#FFF3E0] p-3">
              <p className="text-sm font-medium text-sienna">
                CASL requires documented express consent before contacting older inquiries.
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
                Minimum {MIN_EXPRESS_CONSENT_EVIDENCE_LENGTH} characters. Stored as evidence on the consent record.
              </p>
            </div>
          )}

          {consentMode === 'existing_customer' && (
            <div className="space-y-3 rounded-md border border-input bg-muted/20 p-3">
              <div className="space-y-2">
                <Label htmlFor="transactionDate">
                  Transaction date (when you were paid by this customer) *
                </Label>
                <Input
                  id="transactionDate"
                  name="transactionDate"
                  type="date"
                  required
                  max={today}
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  CASL §10(10)(a) allows outbound for 24 months from the transaction date.
                </p>
                {!transactionWithinWindow && (
                  <p className="text-xs text-[#C15B2E]">
                    Transaction must be within the last 24 months ({CASL_EXISTING_CUSTOMER_DAYS} days).
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerNotes">Notes (optional)</Label>
                <Textarea
                  id="customerNotes"
                  name="customerNotes"
                  rows={2}
                  placeholder="e.g., Kitchen renovation completed Jul 2024, $52K"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                />
              </div>
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
