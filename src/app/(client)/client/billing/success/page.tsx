import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getStripeClient } from '@/lib/clients/stripe';

interface SuccessPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function BillingSuccessPage({ searchParams }: SuccessPageProps) {
  const { session_id } = await searchParams;

  let planName = 'your selected plan';
  let status: 'complete' | 'pending' = 'pending';

  if (session_id) {
    try {
      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (session.status === 'complete') {
        status = 'complete';
      } else {
        status = 'pending';
      }

      // Try to get plan name from metadata
      if (session.metadata?.planId) {
        // Fetch plan name from line items
        const lineItems = await stripe.checkout.sessions.listLineItems(session_id, { limit: 1 });
        if (lineItems.data[0]?.description) {
          planName = lineItems.data[0].description;
        }
      }
    } catch (err) {
      console.error('[BillingSuccess] Failed to retrieve checkout session:', err);
    }
  }

  return (
    <div className="max-w-lg mx-auto py-12">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F5E9]">
            <CheckCircle className="h-8 w-8 text-[#3D7A50]" />
          </div>
          <CardTitle className="text-2xl">
            {status === 'complete'
              ? 'Subscription Activated!'
              : 'Payment Being Processed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === 'complete' ? (
            <p className="text-muted-foreground">
              You&apos;re now subscribed to <strong>{planName}</strong>.
              Your account has been activated and all features are ready to use.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground">
                Your payment is being processed. This usually takes just a moment.
                Your subscription will be activated automatically once confirmed.
              </p>
              <p className="text-sm text-muted-foreground">
                If this page doesn&apos;t update within a few minutes, check your
                {' '}<Link href="/client/billing" className="text-olive underline">billing page</Link>{' '}
                or contact support.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-4">
            <Button asChild>
              <Link href="/client/billing">View Billing Details</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/client">Go to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
