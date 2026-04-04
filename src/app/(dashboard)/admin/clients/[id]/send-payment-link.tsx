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
import { CreditCard, Send, CheckCircle } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
}

interface SendPaymentLinkProps {
  clientId: string;
  clientName: string;
  plans: Plan[];
}

export function SendPaymentLink({ clientId, clientName, plans }: SendPaymentLinkProps) {
  const [open, setOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!selectedPlanId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/payment-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlanId }),
      });

      const data = await res.json() as { success?: boolean; error?: string };

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Reset state when dialog closes
      setSuccess(false);
      setError(null);
      setLoading(false);
      setSelectedPlanId(plans[0]?.id ?? '');
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 w-full cursor-pointer">
        <CreditCard className="h-4 w-4" />
        Send Payment Link
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Payment Link</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle className="h-10 w-10 text-[#3D7A50]" />
            <p className="text-center text-sm text-[#1B2F26] font-medium">
              Payment link sent to {clientName}
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label
                htmlFor="plan-select"
                className="text-sm font-medium text-[#1B2F26]"
              >
                Plan
              </label>
              <select
                id="plan-select"
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-sm text-[#C15B2E]">{error}</p>
            )}

            <Button
              onClick={handleSend}
              disabled={loading || !selectedPlanId}
              className="w-full cursor-pointer"
            >
              <Send className="h-4 w-4 mr-2" />
              {loading ? 'Sending...' : 'Send'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
