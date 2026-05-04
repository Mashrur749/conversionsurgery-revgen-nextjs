'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CreditCard, Copy, CheckCircle, ExternalLink } from 'lucide-react';

interface PlanOption {
  id: string;
  name: string;
  slug: string;
  priceSetupCents: number;
  priceMonthly: number;
  maxActiveClients: number | null;
  activeCount: number;
}

interface GenerateCheckoutLinkProps {
  clientId: string;
  clientName: string;
  plans: PlanOption[];
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

export function GenerateCheckoutLink({ clientId, clientName, plans }: GenerateCheckoutLinkProps) {
  const [open, setOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const isPilotAtCap = selectedPlan?.maxActiveClients !== null &&
    selectedPlan !== undefined &&
    selectedPlan.activeCount >= (selectedPlan.maxActiveClients ?? Infinity);

  async function handleGenerate() {
    if (!selectedPlanId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/checkout-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlanId }),
      });

      const data = await res.json() as { url?: string; error?: string; activeCount?: number; maxAllowed?: number };

      if (!res.ok) {
        if (res.status === 409) {
          setError(`Plan capacity reached (${data.activeCount}/${data.maxAllowed} active)`);
        } else {
          setError(data.error ?? 'Something went wrong');
        }
        return;
      }

      setCheckoutUrl(data.url ?? null);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!checkoutUrl) return;
    await navigator.clipboard.writeText(checkoutUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setCheckoutUrl(null);
      setError(null);
      setLoading(false);
      setCopied(false);
      setSelectedPlanId(plans[0]?.id ?? '');
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 w-full cursor-pointer">
        <CreditCard className="h-4 w-4" />
        Generate Checkout Link
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Checkout Link for {clientName}</DialogTitle>
        </DialogHeader>

        {checkoutUrl ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-[#3D7A50] shrink-0" />
              <p className="text-sm font-medium text-[#1B2F26]">Checkout link generated</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={checkoutUrl}
                className="flex-1 h-9 rounded-md border border-input bg-muted px-3 py-1 text-xs font-mono truncate"
              />
              <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0 cursor-pointer">
                {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="cursor-pointer">
                <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open in new tab
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Send this link to {clientName}. Payment includes setup fee + first month.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label htmlFor="plan-select" className="text-sm font-medium text-[#1B2F26]">
                Select Plan
              </label>
              <select
                id="plan-select"
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {plans.map((plan) => {
                  const atCap = plan.maxActiveClients !== null &&
                    plan.activeCount >= (plan.maxActiveClients ?? Infinity);
                  return (
                    <option key={plan.id} value={plan.id} disabled={atCap}>
                      {plan.name} — {formatCents(plan.priceSetupCents)} setup + {formatCents(plan.priceMonthly)}/mo
                      {atCap ? ` (${plan.activeCount}/${plan.maxActiveClients} — full)` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedPlan && (
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <p><span className="font-medium">Setup:</span> {formatCents(selectedPlan.priceSetupCents)}</p>
                <p><span className="font-medium">Monthly:</span> {formatCents(selectedPlan.priceMonthly)}</p>
                <p><span className="font-medium">Terms:</span> 90-day minimum, then month-to-month</p>
                {selectedPlan.maxActiveClients !== null && (
                  <p className="text-xs text-muted-foreground">
                    Capacity: {selectedPlan.activeCount}/{selectedPlan.maxActiveClients} active
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-[#C15B2E]">{error}</p>
            )}

            <Button
              onClick={handleGenerate}
              disabled={loading || !selectedPlanId || isPilotAtCap}
              className="w-full cursor-pointer"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {loading ? 'Generating...' : 'Generate Checkout Link'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
