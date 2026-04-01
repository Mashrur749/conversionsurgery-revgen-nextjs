import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getValueSummary, getPendingCancellation } from '@/lib/services/cancellation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CancellationFlow } from './cancellation-flow';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default async function CancelPage() {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  // Check for pending cancellation
  const pending = await getPendingCancellation(session.clientId);
  if (pending) {
    redirect('/client/cancel/pending');
  }

  const valueSummary = await getValueSummary(session.clientId);

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Cancel Your Subscription</h1>
        <p className="text-muted-foreground mt-2">
          Complete the form below to request cancellation.
        </p>
      </div>

      <CancellationFlow clientId={session.clientId} valueSummary={valueSummary} />

      {/* Value Summary — collapsed by default so it does not feel like a retention wall */}
      <Accordion type="single" collapsible>
        <AccordionItem value="results" className="rounded-lg border">
          <AccordionTrigger className="px-4">
            Review your results before cancelling
          </AccordionTrigger>
          <AccordionContent className="px-4">
            <Card className="border border-[#3D7A50]/30 bg-[#E8F5E9]">
              <CardHeader>
                <CardTitle className="text-[#3D7A50]">Your Results So Far</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-[#3D7A50]">{valueSummary.totalLeads}</p>
                    <p className="text-sm text-[#3D7A50]">Leads Captured</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-[#3D7A50]">{valueSummary.totalMessages}</p>
                    <p className="text-sm text-[#3D7A50]">Messages Sent</p>
                  </div>
                </div>

                <div className="border-t border-[#3D7A50]/30 pt-4">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-[#3D7A50]">
                      ${valueSummary.estimatedRevenue.toLocaleString()}
                    </p>
                    <p className="text-sm text-[#3D7A50]">Estimated Revenue Generated</p>
                  </div>
                </div>

                <div className="bg-[#E8F5E9] rounded-lg p-3 text-center">
                  <p className="text-lg font-semibold text-[#3D7A50]">
                    {valueSummary.roi}% ROI
                  </p>
                  <p className="text-xs text-[#3D7A50]">
                    ${valueSummary.monthlyCost}/mo investment &rarr; ${valueSummary.estimatedRevenue.toLocaleString()} return
                  </p>
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="text-center">
        <Button asChild variant="link">
          <Link href="/client">&larr; Never mind, take me back</Link>
        </Button>
      </div>
    </div>
  );
}
