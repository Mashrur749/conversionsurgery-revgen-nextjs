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
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
            <div className="flex items-center gap-2 text-blue-800">
              <Phone className="h-5 w-5" />
              <span className="font-medium">Missed Calls Recovered</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-blue-900">
                {outcomes.missedCallsRecovered.responded}
              </span>
              <span className="text-blue-700">
                {' '}
                of {outcomes.missedCallsRecovered.contacted}
              </span>
            </div>
            {outcomes.missedCallsRecovered.contacted > 0 && (
              <p className="text-sm text-blue-600 mt-1">
                {outcomes.missedCallsRecovered.rate.toFixed(0)}% recovery rate
              </p>
            )}
          </div>

          {/* Estimates */}
          <div className="p-4 rounded-lg bg-green-50 border border-green-100">
            <div className="flex items-center gap-2 text-green-800">
              <FileText className="h-5 w-5" />
              <span className="font-medium">Estimate Follow-ups</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-green-900">
                {outcomes.estimateFollowUps.converted}
              </span>
              <span className="text-green-700">
                {' '}
                converted of {outcomes.estimateFollowUps.sent} sent
              </span>
            </div>
            {outcomes.estimateFollowUps.sent > 0 && (
              <p className="text-sm text-green-600 mt-1">
                {outcomes.estimateFollowUps.rate.toFixed(0)}% close rate
              </p>
            )}
          </div>

          {/* Payments */}
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
            <div className="flex items-center gap-2 text-emerald-800">
              <DollarSign className="h-5 w-5" />
              <span className="font-medium">Revenue Recovered</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-emerald-900">
                ${outcomes.paymentReminders.amount.toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-emerald-600 mt-1">
              {outcomes.paymentReminders.collected} invoices collected
            </p>
          </div>

          {/* Reviews */}
          <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-100">
            <div className="flex items-center gap-2 text-yellow-800">
              <Star className="h-5 w-5" />
              <span className="font-medium">Reviews Received</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-yellow-900">
                {outcomes.reviewRequests.received}
              </span>
              <span className="text-yellow-700">
                {' '}
                of {outcomes.reviewRequests.sent} requested
              </span>
            </div>
            {outcomes.reviewRequests.sent > 0 && (
              <p className="text-sm text-yellow-600 mt-1">
                {outcomes.reviewRequests.rate.toFixed(0)}% response rate
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
