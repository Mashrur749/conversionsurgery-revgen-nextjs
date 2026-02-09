# Phase 42: Billing UI & Subscription Management

## Overview
Complete billing user interface enabling clients to manage subscriptions, payment methods, view invoices, handle upgrade/downgrade flows, and resolve failed payments. Integrates with the billing schema from Phase 41.

## Dependencies
- Phase 41: Billing schema (subscriptions, invoices, payment_methods tables)
- Phase 12a: Client dashboard (base layout)
- Phase 07c: Admin dashboard (admin billing views)

## UI Components

### File: `src/components/billing/SubscriptionCard.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { format, differenceInDays } from 'date-fns';
import { CreditCard, Calendar, AlertTriangle, CheckCircle, Pause, X } from 'lucide-react';
import { CancelSubscriptionDialog } from './CancelSubscriptionDialog';
import { PauseSubscriptionDialog } from './PauseSubscriptionDialog';

interface SubscriptionCardProps {
  subscription: {
    id: string;
    status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused';
    plan: {
      name: string;
      priceMonthly: number;
      includedLeads: number | null;
      includedMessages: number | null;
    };
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    currentPeriodLeads: number;
    currentPeriodMessages: number;
    discountPercent: number | null;
  };
  onUpgrade: () => void;
  onCancelSubscription: (reason: string) => Promise<void>;
  onPauseSubscription: (resumeDate: Date) => Promise<void>;
  onResumeSubscription: () => Promise<void>;
}

export function SubscriptionCard({
  subscription,
  onUpgrade,
  onCancelSubscription,
  onPauseSubscription,
  onResumeSubscription,
}: SubscriptionCardProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);

  const statusConfig = {
    trialing: { label: 'Trial', color: 'bg-blue-100 text-blue-800', icon: Calendar },
    active: { label: 'Active', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    past_due: { label: 'Past Due', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
    canceled: { label: 'Canceled', color: 'bg-gray-100 text-gray-800', icon: X },
    unpaid: { label: 'Unpaid', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
    paused: { label: 'Paused', color: 'bg-yellow-100 text-yellow-800', icon: Pause },
  };

  const status = statusConfig[subscription.status];
  const StatusIcon = status.icon;

  const daysRemaining = differenceInDays(subscription.currentPeriodEnd, new Date());
  const trialDaysRemaining = subscription.trialEnd 
    ? differenceInDays(subscription.trialEnd, new Date())
    : null;

  const leadsUsagePercent = subscription.plan.includedLeads
    ? Math.min((subscription.currentPeriodLeads / subscription.plan.includedLeads) * 100, 100)
    : 0;
  
  const messagesUsagePercent = subscription.plan.includedMessages
    ? Math.min((subscription.currentPeriodMessages / subscription.plan.includedMessages) * 100, 100)
    : 0;

  const effectivePrice = subscription.discountPercent
    ? subscription.plan.priceMonthly * (1 - subscription.discountPercent / 100)
    : subscription.plan.priceMonthly;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {subscription.plan.name} Plan
              </CardTitle>
              <CardDescription>
                ${(effectivePrice / 100).toFixed(2)}/month
                {subscription.discountPercent && (
                  <span className="ml-2 text-green-600">
                    ({subscription.discountPercent}% discount applied)
                  </span>
                )}
              </CardDescription>
            </div>
            <Badge className={status.color}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {status.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Trial Banner */}
          {subscription.status === 'trialing' && trialDaysRemaining !== null && (
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                <strong>{trialDaysRemaining} days</strong> remaining in your trial.
                Your card will be charged on {format(subscription.trialEnd!, 'MMM d, yyyy')}.
              </p>
            </div>
          )}

          {/* Past Due Warning */}
          {subscription.status === 'past_due' && (
            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-sm text-red-800">
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                Your payment is past due. Please update your payment method to avoid service interruption.
              </p>
            </div>
          )}

          {/* Cancellation Pending */}
          {subscription.cancelAtPeriodEnd && (
            <div className="rounded-lg bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800">
                Your subscription will cancel on {format(subscription.currentPeriodEnd, 'MMM d, yyyy')}.
                You can still use all features until then.
              </p>
            </div>
          )}

          {/* Billing Period */}
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Current billing period</span>
              <span>{daysRemaining} days remaining</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {format(subscription.currentPeriodStart, 'MMM d')} - {format(subscription.currentPeriodEnd, 'MMM d, yyyy')}
            </div>
          </div>

          {/* Usage */}
          {subscription.plan.includedLeads && (
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span>Leads this period</span>
                <span>
                  {subscription.currentPeriodLeads} / {subscription.plan.includedLeads}
                </span>
              </div>
              <Progress value={leadsUsagePercent} className="h-2" />
              {leadsUsagePercent >= 80 && (
                <p className="mt-1 text-xs text-amber-600">
                  Approaching lead limit. Consider upgrading for more capacity.
                </p>
              )}
            </div>
          )}

          {subscription.plan.includedMessages && (
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span>Messages this period</span>
                <span>
                  {subscription.currentPeriodMessages} / {subscription.plan.includedMessages}
                </span>
              </div>
              <Progress value={messagesUsagePercent} className="h-2" />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={onUpgrade}>
              Upgrade Plan
            </Button>
            
            {subscription.status === 'paused' ? (
              <Button variant="outline" onClick={onResumeSubscription}>
                Resume Subscription
              </Button>
            ) : subscription.status === 'active' && (
              <Button variant="outline" onClick={() => setShowPauseDialog(true)}>
                Pause Subscription
              </Button>
            )}
            
            {!subscription.cancelAtPeriodEnd && subscription.status !== 'canceled' && (
              <Button
                variant="ghost"
                className="text-red-600 hover:text-red-700"
                onClick={() => setShowCancelDialog(true)}
              >
                Cancel Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <CancelSubscriptionDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={onCancelSubscription}
        endDate={subscription.currentPeriodEnd}
      />

      <PauseSubscriptionDialog
        open={showPauseDialog}
        onOpenChange={setShowPauseDialog}
        onConfirm={onPauseSubscription}
      />
    </>
  );
}
```

### File: `src/components/billing/CancelSubscriptionDialog.tsx`

```typescript
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
            We're sorry to see you go. Your subscription will remain active until{' '}
            <strong>{format(endDate, 'MMMM d, yyyy')}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <strong>Before you cancel:</strong> Would a pause work better? You can pause
            for up to 3 months and keep your data intact.
          </div>

          <div className="space-y-2">
            <Label>Please tell us why you're leaving</Label>
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
```

### File: `src/components/billing/PauseSubscriptionDialog.tsx`

```typescript
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
```

### File: `src/components/billing/PaymentMethodCard.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { AddPaymentMethodDialog } from './AddPaymentMethodDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'us_bank_account';
  isDefault: boolean;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  bankAccount?: {
    bankName: string;
    last4: string;
  };
}

interface PaymentMethodCardProps {
  paymentMethods: PaymentMethod[];
  onAddPaymentMethod: (paymentMethodId: string) => Promise<void>;
  onRemovePaymentMethod: (id: string) => Promise<void>;
  onSetDefault: (id: string) => Promise<void>;
  hasFailedPayment?: boolean;
}

const cardBrandIcons: Record<string, string> = {
  visa: '💳',
  mastercard: '💳',
  amex: '💳',
  discover: '💳',
};

export function PaymentMethodCard({
  paymentMethods,
  onAddPaymentMethod,
  onRemovePaymentMethod,
  onSetDefault,
  hasFailedPayment,
}: PaymentMethodCardProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (deleteId) {
      await onRemovePaymentMethod(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Methods
          </CardTitle>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Method
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasFailedPayment && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              Your last payment failed. Please update your payment method.
            </div>
          )}

          {paymentMethods.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No payment methods added yet.
            </p>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {method.type === 'card'
                        ? cardBrandIcons[method.card?.brand || 'visa']
                        : '🏦'}
                    </div>
                    <div>
                      {method.type === 'card' && method.card ? (
                        <>
                          <p className="font-medium capitalize">
                            {method.card.brand} •••• {method.card.last4}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Expires {method.card.expMonth}/{method.card.expYear}
                          </p>
                        </>
                      ) : method.bankAccount ? (
                        <>
                          <p className="font-medium">
                            {method.bankAccount.bankName} •••• {method.bankAccount.last4}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Bank Account
                          </p>
                        </>
                      ) : null}
                    </div>
                    {method.isDefault && (
                      <Badge variant="secondary">Default</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!method.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSetDefault(method.id)}
                      >
                        Set Default
                      </Button>
                    )}
                    {!method.isDefault && paymentMethods.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => setDeleteId(method.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddPaymentMethodDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onAdd={onAddPaymentMethod}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this payment method?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

### File: `src/components/billing/AddPaymentMethodDialog.tsx`

```typescript
'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface AddPaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (paymentMethodId: string) => Promise<void>;
}

function PaymentMethodForm({
  onAdd,
  onClose,
}: {
  onAdd: (paymentMethodId: string) => Promise<void>;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError('Card element not found');
      setIsProcessing(false);
      return;
    }

    const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (stripeError) {
      setError(stripeError.message || 'Failed to add payment method');
      setIsProcessing(false);
      return;
    }

    try {
      await onAdd(paymentMethod.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add payment method');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="py-4 space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border p-4">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || isProcessing}>
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Add Card'
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddPaymentMethodDialog({
  open,
  onOpenChange,
  onAdd,
}: AddPaymentMethodDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payment Method</DialogTitle>
          <DialogDescription>
            Add a new credit or debit card to your account.
          </DialogDescription>
        </DialogHeader>

        <Elements stripe={stripePromise}>
          <PaymentMethodForm
            onAdd={onAdd}
            onClose={() => onOpenChange(false)}
          />
        </Elements>
      </DialogContent>
    </Dialog>
  );
}
```

### File: `src/components/billing/InvoiceList.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { Download, FileText, ExternalLink } from 'lucide-react';

interface Invoice {
  id: string;
  number: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  amountDue: number;
  amountPaid: number;
  createdAt: Date;
  dueDate: Date | null;
  paidAt: Date | null;
  invoicePdfUrl: string | null;
  stripeInvoiceUrl: string | null;
  lineItems: {
    description: string;
    amount: number;
    quantity: number;
  }[];
}

interface InvoiceListProps {
  invoices: Invoice[];
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function InvoiceList({ invoices, onLoadMore, hasMore }: InvoiceListProps) {
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  const statusConfig = {
    draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
    open: { label: 'Open', color: 'bg-blue-100 text-blue-800' },
    paid: { label: 'Paid', color: 'bg-green-100 text-green-800' },
    void: { label: 'Void', color: 'bg-gray-100 text-gray-800' },
    uncollectible: { label: 'Uncollectible', color: 'bg-red-100 text-red-800' },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Invoice History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No invoices yet.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <>
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        setExpandedInvoice(
                          expandedInvoice === invoice.id ? null : invoice.id
                        )
                      }
                    >
                      <TableCell className="font-medium">
                        {invoice.number}
                      </TableCell>
                      <TableCell>
                        {format(invoice.createdAt, 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[invoice.status].color}>
                          {statusConfig[invoice.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        ${(invoice.amountDue / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {invoice.invoicePdfUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(invoice.invoicePdfUrl!, '_blank');
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          {invoice.stripeInvoiceUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(invoice.stripeInvoiceUrl!, '_blank');
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedInvoice === invoice.id && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/30">
                          <div className="p-4 space-y-2">
                            <h4 className="font-medium">Line Items</h4>
                            {invoice.lineItems.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between text-sm"
                              >
                                <span>
                                  {item.description}
                                  {item.quantity > 1 && ` × ${item.quantity}`}
                                </span>
                                <span>${(item.amount / 100).toFixed(2)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between font-medium pt-2 border-t">
                              <span>Total</span>
                              <span>
                                ${(invoice.amountDue / 100).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>

            {hasMore && (
              <div className="mt-4 text-center">
                <Button variant="outline" onClick={onLoadMore}>
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

### File: `src/components/billing/PlanSelector.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number | null;
  includedLeads: number | null;
  includedMessages: number | null;
  includedTeamMembers: number;
  features: string[];
  isPopular?: boolean;
}

interface PlanSelectorProps {
  plans: Plan[];
  currentPlanId: string | null;
  onSelectPlan: (planId: string, billingCycle: 'monthly' | 'yearly') => Promise<void>;
  isChangingPlan?: boolean;
}

export function PlanSelector({
  plans,
  currentPlanId,
  onSelectPlan,
  isChangingPlan,
}: PlanSelectorProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const hasYearlyPricing = plans.some((p) => p.priceYearly !== null);
  const yearlySavingsPercent = 20; // Typical annual discount

  const handleSelect = async (planId: string) => {
    setSelectedPlanId(planId);
    try {
      await onSelectPlan(planId, billingCycle);
    } finally {
      setSelectedPlanId(null);
    }
  };

  return (
    <div className="space-y-6">
      {hasYearlyPricing && (
        <div className="flex items-center justify-center gap-4">
          <Label htmlFor="billing-toggle" className={cn(billingCycle === 'monthly' && 'font-bold')}>
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={billingCycle === 'yearly'}
            onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="billing-toggle" className={cn(billingCycle === 'yearly' && 'font-bold')}>
              Yearly
            </Label>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Save {yearlySavingsPercent}%
            </Badge>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrentPlan = plan.id === currentPlanId;
          const price = billingCycle === 'yearly' && plan.priceYearly
            ? plan.priceYearly / 12
            : plan.priceMonthly;
          const isDowngrade = currentPlanId && plans.findIndex((p) => p.id === plan.id) <
            plans.findIndex((p) => p.id === currentPlanId);

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative',
                plan.isPopular && 'border-primary shadow-lg',
                isCurrentPlan && 'bg-muted/50'
              )}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                {plan.description && (
                  <CardDescription>{plan.description}</CardDescription>
                )}
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    ${(price / 100).toFixed(0)}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                  {billingCycle === 'yearly' && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Billed annually (${((plan.priceYearly || price * 12) / 100).toFixed(0)}/year)
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600" />
                    {plan.includedLeads
                      ? `${plan.includedLeads.toLocaleString()} leads/month`
                      : 'Unlimited leads'}
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600" />
                    {plan.includedMessages
                      ? `${plan.includedMessages.toLocaleString()} messages/month`
                      : 'Unlimited messages'}
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600" />
                    {plan.includedTeamMembers} team members
                  </li>
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={isCurrentPlan ? 'outline' : plan.isPopular ? 'default' : 'outline'}
                  disabled={isCurrentPlan || isChangingPlan}
                  onClick={() => handleSelect(plan.id)}
                >
                  {selectedPlanId === plan.id ? (
                    'Processing...'
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : isDowngrade ? (
                    'Downgrade'
                  ) : (
                    'Upgrade'
                  )}
                </Button>

                {isDowngrade && !isCurrentPlan && (
                  <p className="text-xs text-center text-muted-foreground">
                    Takes effect at end of current billing period
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

### File: `src/components/billing/UsageDisplay.tsx`

```typescript
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, TrendingUp } from 'lucide-react';

interface UsageDisplayProps {
  usage: {
    leads: {
      used: number;
      included: number | null;
      overage: number;
      overagePrice: number | null;
    };
    messages: {
      used: number;
      included: number | null;
      overage: number;
      overagePrice: number | null;
    };
    teamMembers: {
      used: number;
      included: number;
    };
    phoneNumbers: {
      used: number;
      included: number;
    };
  };
  periodStart: Date;
  periodEnd: Date;
}

export function UsageDisplay({ usage, periodStart, periodEnd }: UsageDisplayProps) {
  const totalOverageCharges =
    (usage.leads.overage * (usage.leads.overagePrice || 0)) +
    (usage.messages.overage * (usage.messages.overagePrice || 0));

  const leadsPercent = usage.leads.included
    ? Math.min((usage.leads.used / usage.leads.included) * 100, 100)
    : 0;
  
  const messagesPercent = usage.messages.included
    ? Math.min((usage.messages.used / usage.messages.included) * 100, 100)
    : 0;

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return 'bg-red-500';
    if (percent >= 80) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Usage This Period
        </CardTitle>
        <CardDescription>
          {periodStart.toLocaleDateString()} - {periodEnd.toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overage Warning */}
        {totalOverageCharges > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You have ${(totalOverageCharges / 100).toFixed(2)} in overage charges this period.
            </AlertDescription>
          </Alert>
        )}

        {/* Leads */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Leads</span>
            <span>
              {usage.leads.used.toLocaleString()}
              {usage.leads.included && ` / ${usage.leads.included.toLocaleString()}`}
              {!usage.leads.included && ' (Unlimited)'}
            </span>
          </div>
          {usage.leads.included && (
            <>
              <Progress
                value={leadsPercent}
                className="h-2"
                indicatorClassName={getProgressColor(leadsPercent)}
              />
              {usage.leads.overage > 0 && (
                <p className="text-xs text-red-600 mt-1">
                  +{usage.leads.overage} overage leads 
                  ({usage.leads.overagePrice && `$${(usage.leads.overagePrice / 100).toFixed(2)}/lead`})
                </p>
              )}
            </>
          )}
        </div>

        {/* Messages */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Messages</span>
            <span>
              {usage.messages.used.toLocaleString()}
              {usage.messages.included && ` / ${usage.messages.included.toLocaleString()}`}
              {!usage.messages.included && ' (Unlimited)'}
            </span>
          </div>
          {usage.messages.included && (
            <>
              <Progress
                value={messagesPercent}
                className="h-2"
                indicatorClassName={getProgressColor(messagesPercent)}
              />
              {usage.messages.overage > 0 && (
                <p className="text-xs text-red-600 mt-1">
                  +{usage.messages.overage} overage messages
                  ({usage.messages.overagePrice && `$${(usage.messages.overagePrice / 100).toFixed(2)}/msg`})
                </p>
              )}
            </>
          )}
        </div>

        {/* Team Members */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Team Members</span>
            <span>
              {usage.teamMembers.used} / {usage.teamMembers.included}
            </span>
          </div>
          <Progress
            value={(usage.teamMembers.used / usage.teamMembers.included) * 100}
            className="h-2"
          />
        </div>

        {/* Phone Numbers */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Phone Numbers</span>
            <span>
              {usage.phoneNumbers.used} / {usage.phoneNumbers.included}
            </span>
          </div>
          <Progress
            value={(usage.phoneNumbers.used / usage.phoneNumbers.included) * 100}
            className="h-2"
          />
        </div>

        {/* Estimated Bill */}
        {totalOverageCharges > 0 && (
          <div className="pt-4 border-t">
            <div className="flex justify-between font-medium">
              <span>Estimated Overage This Period</span>
              <span className="text-red-600">
                +${(totalOverageCharges / 100).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

## Page: Client Billing Dashboard

### File: `src/app/(client)/billing/page.tsx`

```typescript
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getClientSession } from '@/lib/auth/client-session';
import { getBillingData } from '@/lib/billing/queries';
import { SubscriptionCard } from '@/components/billing/SubscriptionCard';
import { PaymentMethodCard } from '@/components/billing/PaymentMethodCard';
import { InvoiceList } from '@/components/billing/InvoiceList';
import { UsageDisplay } from '@/components/billing/UsageDisplay';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Billing | ConversionSurgery',
};

async function BillingContent() {
  const session = await getClientSession();
  if (!session) {
    redirect('/login');
  }

  const {
    subscription,
    paymentMethods,
    invoices,
    usage,
  } = await getBillingData(session.clientId);

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription, payment methods, and invoices.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {subscription && (
            <SubscriptionCard
              subscription={subscription}
              onUpgrade={() => {}}
              onCancelSubscription={async (reason) => {
                'use server';
                const { cancelSubscription } = await import('@/lib/billing/actions');
                await cancelSubscription(session.clientId, reason);
              }}
              onPauseSubscription={async (resumeDate) => {
                'use server';
                const { pauseSubscription } = await import('@/lib/billing/actions');
                await pauseSubscription(session.clientId, resumeDate);
              }}
              onResumeSubscription={async () => {
                'use server';
                const { resumeSubscription } = await import('@/lib/billing/actions');
                await resumeSubscription(session.clientId);
              }}
            />
          )}

          {usage && subscription && (
            <UsageDisplay
              usage={usage}
              periodStart={subscription.currentPeriodStart}
              periodEnd={subscription.currentPeriodEnd}
            />
          )}
        </div>

        <div className="space-y-6">
          <PaymentMethodCard
            paymentMethods={paymentMethods}
            onAddPaymentMethod={async (paymentMethodId) => {
              'use server';
              const { addPaymentMethod } = await import('@/lib/billing/actions');
              await addPaymentMethod(session.clientId, paymentMethodId);
            }}
            onRemovePaymentMethod={async (id) => {
              'use server';
              const { removePaymentMethod } = await import('@/lib/billing/actions');
              await removePaymentMethod(session.clientId, id);
            }}
            onSetDefault={async (id) => {
              'use server';
              const { setDefaultPaymentMethod } = await import('@/lib/billing/actions');
              await setDefaultPaymentMethod(session.clientId, id);
            }}
            hasFailedPayment={subscription?.status === 'past_due'}
          />
        </div>
      </div>

      <InvoiceList invoices={invoices} />
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingSkeleton />}>
      <BillingContent />
    </Suspense>
  );
}

function BillingSkeleton() {
  return (
    <div className="container py-6 space-y-6">
      <div>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-5 w-64 mt-2" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
```

## Page: Upgrade Plan

### File: `src/app/(client)/billing/upgrade/page.tsx`

```typescript
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getClientSession } from '@/lib/auth/client-session';
import { getPlans, getCurrentSubscription } from '@/lib/billing/queries';
import { PlanSelector } from '@/components/billing/PlanSelector';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Upgrade Plan | ConversionSurgery',
};

async function UpgradeContent() {
  const session = await getClientSession();
  if (!session) {
    redirect('/login');
  }

  const [plans, currentSubscription] = await Promise.all([
    getPlans(),
    getCurrentSubscription(session.clientId),
  ]);

  return (
    <div className="container py-6 space-y-6">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold">Choose Your Plan</h1>
        <p className="text-muted-foreground mt-2">
          Upgrade or downgrade your subscription at any time. Changes take effect
          at the start of your next billing cycle.
        </p>
      </div>

      <PlanSelector
        plans={plans}
        currentPlanId={currentSubscription?.planId || null}
        onSelectPlan={async (planId, billingCycle) => {
          'use server';
          const { changePlan } = await import('@/lib/billing/actions');
          await changePlan(session.clientId, planId, billingCycle);
        }}
      />
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<UpgradeSkeleton />}>
      <UpgradeContent />
    </Suspense>
  );
}

function UpgradeSkeleton() {
  return (
    <div className="container py-6 space-y-6">
      <div className="text-center max-w-2xl mx-auto">
        <Skeleton className="h-9 w-64 mx-auto" />
        <Skeleton className="h-5 w-96 mx-auto mt-2" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
```

## Server Actions

### File: `src/lib/billing/actions.ts`

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { subscriptions, paymentMethods, invoices } from '@/db/schema/billing';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';

// Cancel subscription
export async function cancelSubscription(clientId: string, reason: string) {
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.clientId, clientId),
  });

  if (!subscription?.stripeSubscriptionId) {
    throw new Error('No active subscription found');
  }

  // Cancel at period end in Stripe
  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: true,
    cancellation_details: {
      comment: reason,
    },
  });

  // Update local record
  await db.update(subscriptions)
    .set({
      cancelAtPeriodEnd: true,
      cancellationReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.clientId, clientId));

  revalidatePath('/billing');
}

// Pause subscription
export async function pauseSubscription(clientId: string, resumeDate: Date) {
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.clientId, clientId),
  });

  if (!subscription?.stripeSubscriptionId) {
    throw new Error('No active subscription found');
  }

  // Pause in Stripe
  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    pause_collection: {
      behavior: 'void',
      resumes_at: Math.floor(resumeDate.getTime() / 1000),
    },
  });

  // Update local record
  await db.update(subscriptions)
    .set({
      status: 'paused',
      pausedAt: new Date(),
      resumesAt: resumeDate,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.clientId, clientId));

  revalidatePath('/billing');
}

// Resume subscription
export async function resumeSubscription(clientId: string) {
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.clientId, clientId),
  });

  if (!subscription?.stripeSubscriptionId) {
    throw new Error('No active subscription found');
  }

  // Resume in Stripe
  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    pause_collection: '',
  });

  // Update local record
  await db.update(subscriptions)
    .set({
      status: 'active',
      pausedAt: null,
      resumesAt: null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.clientId, clientId));

  revalidatePath('/billing');
}

// Add payment method
export async function addPaymentMethod(clientId: string, paymentMethodId: string) {
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.clientId, clientId),
  });

  if (!subscription?.stripeCustomerId) {
    throw new Error('No customer found');
  }

  // Attach to customer in Stripe
  const stripePaymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
    customer: subscription.stripeCustomerId,
  });

  // Check if this is the first payment method
  const existingMethods = await db.query.paymentMethods.findMany({
    where: eq(paymentMethods.clientId, clientId),
  });

  const isDefault = existingMethods.length === 0;

  // If default, set as default in Stripe
  if (isDefault) {
    await stripe.customers.update(subscription.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  // Store locally
  await db.insert(paymentMethods).values({
    clientId,
    stripePaymentMethodId: paymentMethodId,
    type: stripePaymentMethod.type as 'card' | 'bank_account' | 'us_bank_account',
    isDefault,
    cardBrand: stripePaymentMethod.card?.brand,
    cardLast4: stripePaymentMethod.card?.last4,
    cardExpMonth: stripePaymentMethod.card?.exp_month,
    cardExpYear: stripePaymentMethod.card?.exp_year,
    bankName: stripePaymentMethod.us_bank_account?.bank_name,
    bankLast4: stripePaymentMethod.us_bank_account?.last4,
  });

  revalidatePath('/billing');
}

// Remove payment method
export async function removePaymentMethod(clientId: string, paymentMethodId: string) {
  const method = await db.query.paymentMethods.findFirst({
    where: eq(paymentMethods.id, paymentMethodId),
  });

  if (!method || method.clientId !== clientId) {
    throw new Error('Payment method not found');
  }

  if (method.isDefault) {
    throw new Error('Cannot remove default payment method');
  }

  // Detach from Stripe
  await stripe.paymentMethods.detach(method.stripePaymentMethodId);

  // Delete locally
  await db.delete(paymentMethods).where(eq(paymentMethods.id, paymentMethodId));

  revalidatePath('/billing');
}

// Set default payment method
export async function setDefaultPaymentMethod(clientId: string, paymentMethodId: string) {
  const method = await db.query.paymentMethods.findFirst({
    where: eq(paymentMethods.id, paymentMethodId),
  });

  if (!method || method.clientId !== clientId) {
    throw new Error('Payment method not found');
  }

  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.clientId, clientId),
  });

  if (!subscription?.stripeCustomerId) {
    throw new Error('No customer found');
  }

  // Update in Stripe
  await stripe.customers.update(subscription.stripeCustomerId, {
    invoice_settings: {
      default_payment_method: method.stripePaymentMethodId,
    },
  });

  // Update locally - unset all, then set new default
  await db.update(paymentMethods)
    .set({ isDefault: false })
    .where(eq(paymentMethods.clientId, clientId));

  await db.update(paymentMethods)
    .set({ isDefault: true })
    .where(eq(paymentMethods.id, paymentMethodId));

  revalidatePath('/billing');
}

// Change plan
export async function changePlan(
  clientId: string,
  planId: string,
  billingCycle: 'monthly' | 'yearly'
) {
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.clientId, clientId),
  });

  if (!subscription?.stripeSubscriptionId) {
    throw new Error('No active subscription found');
  }

  const plan = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.id, planId),
  });

  if (!plan) {
    throw new Error('Plan not found');
  }

  // Get the correct price ID based on billing cycle
  const priceId = billingCycle === 'yearly' && plan.stripeYearlyPriceId
    ? plan.stripeYearlyPriceId
    : plan.stripePriceId;

  // Get current subscription items
  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscription.stripeSubscriptionId
  );

  // Update subscription in Stripe
  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    items: [{
      id: stripeSubscription.items.data[0].id,
      price: priceId,
    }],
    proration_behavior: 'create_prorations',
  });

  // Update local record
  await db.update(subscriptions)
    .set({
      planId,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.clientId, clientId));

  revalidatePath('/billing');
  revalidatePath('/billing/upgrade');
}
```

## Admin Billing Management

### File: `src/app/(admin)/admin/billing/page.tsx`

```typescript
import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAdminBillingStats } from '@/lib/billing/admin-queries';
import { AdminSubscriptionTable } from '@/components/admin/billing/AdminSubscriptionTable';
import { RevenueChart } from '@/components/admin/billing/RevenueChart';
import { DollarSign, Users, TrendingUp, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'Billing Management | Admin',
};

async function AdminBillingContent() {
  const stats = await getAdminBillingStats();

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing Management</h1>
        <p className="text-muted-foreground">
          Monitor subscriptions, revenue, and payment issues.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(stats.mrr / 100).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.mrrChange >= 0 ? '+' : ''}{stats.mrrChange}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              {stats.trialingSubscriptions} in trial
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.churnRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.canceledThisMonth} canceled this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed Payments</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.failedPayments}
            </div>
            <p className="text-xs text-muted-foreground">
              ${(stats.failedPaymentsAmount / 100).toLocaleString()} at risk
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <RevenueChart data={stats.revenueHistory} />

      {/* Subscriptions Table */}
      <AdminSubscriptionTable />
    </div>
  );
}

export default function AdminBillingPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminBillingContent />
    </Suspense>
  );
}
```

## Stripe Webhook Handler

### File: `src/app/api/webhooks/stripe/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { db } from '@/db';
import { subscriptions, invoices, paymentMethods } from '@/db/schema/billing';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = headers().get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
        break;

      case 'payment_method.detached':
        await handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleSubscriptionChange(stripeSubscription: Stripe.Subscription) {
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeSubscriptionId, stripeSubscription.id),
  });

  if (!subscription) {
    console.error('Subscription not found:', stripeSubscription.id);
    return;
  }

  await db.update(subscriptions)
    .set({
      status: stripeSubscription.status as any,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      canceledAt: stripeSubscription.canceled_at
        ? new Date(stripeSubscription.canceled_at * 1000)
        : null,
      trialEnd: stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscription.id));
}

async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
  await db.update(subscriptions)
    .set({
      status: 'canceled',
      canceledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscription.id));
}

async function handleInvoicePaid(stripeInvoice: Stripe.Invoice) {
  // Update or create invoice record
  const existing = await db.query.invoices.findFirst({
    where: eq(invoices.stripeInvoiceId, stripeInvoice.id),
  });

  const invoiceData = {
    status: 'paid' as const,
    amountPaid: stripeInvoice.amount_paid,
    paidAt: new Date(),
    invoicePdfUrl: stripeInvoice.invoice_pdf,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(invoices)
      .set(invoiceData)
      .where(eq(invoices.stripeInvoiceId, stripeInvoice.id));
  }

  // Also update subscription status if it was past_due
  if (stripeInvoice.subscription) {
    await db.update(subscriptions)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, stripeInvoice.subscription as string));
  }
}

async function handleInvoicePaymentFailed(stripeInvoice: Stripe.Invoice) {
  // Update invoice status
  await db.update(invoices)
    .set({
      status: 'open',
      updatedAt: new Date(),
    })
    .where(eq(invoices.stripeInvoiceId, stripeInvoice.id));

  // Update subscription to past_due
  if (stripeInvoice.subscription) {
    await db.update(subscriptions)
      .set({
        status: 'past_due',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, stripeInvoice.subscription as string));
  }

  // TODO: Send notification to client about failed payment
}

async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  // Payment method attachment is handled in our action
  // This webhook is for verification/sync purposes
}

async function handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod) {
  await db.delete(paymentMethods)
    .where(eq(paymentMethods.stripePaymentMethodId, paymentMethod.id));
}
```

## Query Functions

### File: `src/lib/billing/queries.ts`

```typescript
import { db } from '@/db';
import { subscriptions, paymentMethods, invoices, subscriptionPlans } from '@/db/schema/billing';
import { usageRecords } from '@/db/schema/usage';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';

export async function getBillingData(clientId: string) {
  const [subscription, methods, invoiceList, usage] = await Promise.all([
    // Get subscription with plan
    db.query.subscriptions.findFirst({
      where: eq(subscriptions.clientId, clientId),
      with: {
        plan: true,
      },
    }),

    // Get payment methods
    db.query.paymentMethods.findMany({
      where: eq(paymentMethods.clientId, clientId),
      orderBy: [desc(paymentMethods.isDefault), desc(paymentMethods.createdAt)],
    }),

    // Get recent invoices
    db.query.invoices.findMany({
      where: eq(invoices.clientId, clientId),
      orderBy: desc(invoices.createdAt),
      limit: 20,
      with: {
        lineItems: true,
      },
    }),

    // Get current period usage
    getUsageForPeriod(clientId),
  ]);

  return {
    subscription: subscription
      ? {
          ...subscription,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
        }
      : null,
    paymentMethods: methods.map((m) => ({
      id: m.id,
      type: m.type,
      isDefault: m.isDefault,
      card: m.type === 'card'
        ? {
            brand: m.cardBrand || '',
            last4: m.cardLast4 || '',
            expMonth: m.cardExpMonth || 0,
            expYear: m.cardExpYear || 0,
          }
        : undefined,
      bankAccount: m.type !== 'card'
        ? {
            bankName: m.bankName || '',
            last4: m.bankLast4 || '',
          }
        : undefined,
    })),
    invoices: invoiceList.map((inv) => ({
      id: inv.id,
      number: inv.number || '',
      status: inv.status,
      amountDue: inv.amountDue,
      amountPaid: inv.amountPaid,
      createdAt: inv.createdAt,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
      invoicePdfUrl: inv.invoicePdfUrl,
      stripeInvoiceUrl: inv.hostedInvoiceUrl,
      lineItems: inv.lineItems.map((item) => ({
        description: item.description,
        amount: item.amount,
        quantity: item.quantity,
      })),
    })),
    usage,
  };
}

async function getUsageForPeriod(clientId: string) {
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.clientId, clientId),
    with: { plan: true },
  });

  if (!subscription) return null;

  const periodStart = subscription.currentPeriodStart;
  const periodEnd = subscription.currentPeriodEnd;

  // Get usage records for current period
  const usageData = await db
    .select({
      totalLeads: sql<number>`coalesce(sum(${usageRecords.leads}), 0)`,
      totalMessages: sql<number>`coalesce(sum(${usageRecords.smsSegments}), 0)`,
    })
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.clientId, clientId),
        gte(usageRecords.date, periodStart),
        lte(usageRecords.date, periodEnd)
      )
    );

  const usage = usageData[0] || { totalLeads: 0, totalMessages: 0 };
  const plan = subscription.plan;

  const leadsOverage = plan.includedLeads
    ? Math.max(0, usage.totalLeads - plan.includedLeads)
    : 0;

  const messagesOverage = plan.includedMessages
    ? Math.max(0, usage.totalMessages - plan.includedMessages)
    : 0;

  return {
    leads: {
      used: usage.totalLeads,
      included: plan.includedLeads,
      overage: leadsOverage,
      overagePrice: plan.overageLeadPrice,
    },
    messages: {
      used: usage.totalMessages,
      included: plan.includedMessages,
      overage: messagesOverage,
      overagePrice: plan.overageMessagePrice,
    },
    teamMembers: {
      used: subscription.currentPeriodLeads, // Would need separate query
      included: plan.includedTeamMembers || 3,
    },
    phoneNumbers: {
      used: 1, // Would need separate query
      included: plan.includedPhoneNumbers || 1,
    },
  };
}

export async function getPlans() {
  return db.query.subscriptionPlans.findMany({
    where: and(
      eq(subscriptionPlans.isActive, true),
      eq(subscriptionPlans.isPublic, true)
    ),
    orderBy: subscriptionPlans.sortOrder,
  });
}

export async function getCurrentSubscription(clientId: string) {
  return db.query.subscriptions.findFirst({
    where: eq(subscriptions.clientId, clientId),
  });
}
```

## Testing Checklist

```markdown
## Billing UI Testing

### Subscription Management
- [ ] Subscription card displays correct plan and status
- [ ] Trial banner shows remaining days
- [ ] Past due warning displays correctly
- [ ] Cancel subscription flow works
- [ ] Pause subscription flow works
- [ ] Resume subscription works
- [ ] Usage progress bars display correctly
- [ ] Overage warnings appear at 80%+ usage

### Payment Methods
- [ ] Add new card via Stripe Elements
- [ ] Set card as default
- [ ] Remove non-default card
- [ ] Cannot remove default card
- [ ] Card brand icons display correctly
- [ ] Failed payment banner shows when past due

### Invoices
- [ ] Invoice list loads and displays
- [ ] Invoice status badges correct
- [ ] Expandable line items work
- [ ] PDF download link works
- [ ] Stripe invoice link works
- [ ] Load more pagination works

### Plan Selection
- [ ] Monthly/yearly toggle works
- [ ] Current plan highlighted
- [ ] Upgrade button processes correctly
- [ ] Downgrade shows correct messaging
- [ ] Proration handled in Stripe

### Webhook Handling
- [ ] subscription.created updates DB
- [ ] subscription.updated syncs status
- [ ] subscription.deleted marks canceled
- [ ] invoice.paid updates records
- [ ] invoice.payment_failed triggers past_due
- [ ] payment_method.attached syncs
- [ ] payment_method.detached removes

### Edge Cases
- [ ] No subscription state handled
- [ ] No payment methods state handled
- [ ] Expired card handling
- [ ] Canceled but still active (period end)
- [ ] Paused subscription display
```

## Implementation Notes

1. **Stripe Setup**: Requires `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` environment variables.

2. **Webhook Endpoint**: Must be registered in Stripe dashboard pointing to `/api/webhooks/stripe`.

3. **Price IDs**: Subscription plans must have valid Stripe Price IDs configured.

4. **Test Mode**: Use Stripe test mode cards (4242 4242 4242 4242) for development.

5. **Proration**: Plan changes automatically prorate - Stripe handles the math.

6. **Error Recovery**: Failed payments trigger dunning emails from Stripe. Consider adding in-app notifications.
