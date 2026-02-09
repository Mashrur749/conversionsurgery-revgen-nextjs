'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DollarSign, Send, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface SendPaymentButtonProps {
  leadId: string;
  clientId: string;
  leadName: string;
  defaultAmount?: number;
}

export function SendPaymentButton({
  leadId,
  clientId,
  leadName,
  defaultAmount,
}: SendPaymentButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(defaultAmount?.toString() || '');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('full');
  const [paymentId, setPaymentId] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const createPayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          leadId,
          amount: parseFloat(amount),
          description: description || `Payment from ${leadName}`,
          type,
        }),
      });

      const data = await res.json() as { paymentLinkUrl?: string; paymentId?: string; error?: string };
      if (data.paymentLinkUrl && data.paymentId) {
        setPaymentId(data.paymentId);
        setPaymentUrl(data.paymentLinkUrl);
        toast.success('Payment link created!');
      } else {
        throw new Error(data.error || 'Failed to create payment');
      }
    } catch (err) {
      toast.error('Failed to create payment link');
    } finally {
      setLoading(false);
    }
  };

  const sendPaymentSMS = async () => {
    if (!paymentId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}/send`, {
        method: 'POST',
      });

      if (res.ok) {
        toast.success('Payment link sent via SMS!');
        setOpen(false);
        resetForm();
      } else {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || 'Failed to send');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send payment link');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(paymentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied!');
  };

  const resetForm = () => {
    setAmount(defaultAmount?.toString() || '');
    setDescription('');
    setType('full');
    setPaymentId('');
    setPaymentUrl('');
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <DollarSign className="h-4 w-4 mr-1" />
        Send Payment
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Payment Request to {leadName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!!paymentUrl}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="What is this payment for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!!paymentUrl}
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Type</Label>
            <Select value={type} onValueChange={setType} disabled={!!paymentUrl}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Payment</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="progress">Progress Payment</SelectItem>
                <SelectItem value="final">Final Payment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentUrl && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <Label className="text-xs text-muted-foreground">
                Payment Link Created
              </Label>
              <div className="flex gap-2">
                <Input value={paymentUrl} readOnly className="text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyLink}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            {!paymentUrl ? (
              <Button
                onClick={createPayment}
                disabled={loading || !amount}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4 mr-2" />
                )}
                Create Payment Link
              </Button>
            ) : (
              <Button
                onClick={sendPaymentSMS}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send via SMS
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
}
