'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Phone,
  FileText,
  DollarSign,
  Star,
  TrendingUp,
} from 'lucide-react';

interface ClientOutcomesProps {
  clientId: string;
}

interface Outcomes {
  period: string;
  missedCallsRecovered: { contacted: number; responded: number; rate: number };
  estimateFollowUps: { sent: number; converted: number; rate: number };
  paymentReminders: { sent: number; collected: number; amount: number };
  reviewRequests: { sent: number; received: number; rate: number };
}

export function ClientOutcomes({ clientId }: ClientOutcomesProps) {
  const [outcomes, setOutcomes] = useState<Outcomes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/outcomes`)
      .then((r) => r.json() as Promise<Outcomes>)
      .then((data) => {
        setOutcomes(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  if (loading || !outcomes) {
    return (
      <Card>
        <CardContent className="py-8">Loading...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Your Results This Month
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Missed Calls */}
          <div className="p-4 rounded-lg bg-sage-light border border-forest-light/20">
            <div className="flex items-center gap-2 text-forest">
              <Phone className="h-5 w-5" />
              <span className="font-medium">Missed Calls Recovered</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-forest">
                {outcomes.missedCallsRecovered.responded}
              </span>
              <span className="text-forest">
                {' '}
                of {outcomes.missedCallsRecovered.contacted}
              </span>
            </div>
            {outcomes.missedCallsRecovered.contacted > 0 && (
              <p className="text-sm text-forest mt-1">
                {outcomes.missedCallsRecovered.rate.toFixed(0)}% recovery rate
              </p>
            )}
          </div>

          {/* Estimates */}
          <div className="p-4 rounded-lg bg-[#E8F5E9] border border-[#3D7A50]/20">
            <div className="flex items-center gap-2 text-[#3D7A50]">
              <FileText className="h-5 w-5" />
              <span className="font-medium">Estimate Follow-ups</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-[#3D7A50]">
                {outcomes.estimateFollowUps.converted}
              </span>
              <span className="text-[#3D7A50]">
                {' '}
                converted of {outcomes.estimateFollowUps.sent} sent
              </span>
            </div>
            {outcomes.estimateFollowUps.sent > 0 && (
              <p className="text-sm text-[#3D7A50] mt-1">
                {outcomes.estimateFollowUps.rate.toFixed(0)}% close rate
              </p>
            )}
          </div>

          {/* Payments */}
          <div className="p-4 rounded-lg bg-[#E8F5E9] border border-emerald-100">
            <div className="flex items-center gap-2 text-[#3D7A50]">
              <DollarSign className="h-5 w-5" />
              <span className="font-medium">Revenue Recovered</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-[#3D7A50]">
                ${outcomes.paymentReminders.amount.toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-[#3D7A50] mt-1">
              {outcomes.paymentReminders.collected} invoices collected
            </p>
          </div>

          {/* Reviews */}
          <div className="p-4 rounded-lg bg-[#FFF3E0] border border-sienna/20">
            <div className="flex items-center gap-2 text-sienna">
              <Star className="h-5 w-5" />
              <span className="font-medium">Reviews Received</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-sienna">
                {outcomes.reviewRequests.received}
              </span>
              <span className="text-sienna">
                {' '}
                of {outcomes.reviewRequests.sent} requested
              </span>
            </div>
            {outcomes.reviewRequests.sent > 0 && (
              <p className="text-sm text-sienna mt-1">
                {outcomes.reviewRequests.rate.toFixed(0)}% response rate
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
