'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Users } from 'lucide-react';

interface SubscriptionRow {
  clientName: string;
  planName: string;
  status: string;
  priceMonthly: number;
  currentPeriodEnd: string | null;
  createdAt: string;
  guarantee: {
    status: string;
    statusLabel: string;
    stage: 'proof' | 'recovery' | 'fulfilled' | 'refund_review';
    refundReviewRequired: boolean;
    refundEligibleAt: string | null;
    notes: string | null;
    proofQualifiedLeadEngagements: number;
    recoveryAttributedOpportunities: number;
    proofWindow: {
      startAt: string | null;
      adjustedEndAt: string | null;
    };
    recoveryWindow: {
      startAt: string | null;
      adjustedEndAt: string | null;
    };
    extension: {
      factorMultiplier: number;
      observedMonthlyLeadAverage: number | null;
      adjusted: boolean;
    };
    timeline: {
      key: 'proof' | 'recovery';
      label: string;
      state: 'pending' | 'active' | 'completed' | 'failed';
      detail: string;
    }[];
  };
}

const statusColors: Record<string, string> = {
  trialing: 'bg-sage-light text-forest',
  active: 'bg-[#E8F5E9] text-[#3D7A50]',
  past_due: 'bg-[#FDEAE4] text-sienna',
  canceled: 'bg-muted text-foreground',
  unpaid: 'bg-[#FDEAE4] text-sienna',
  paused: 'bg-[#FFF3E0] text-sienna',
};

const guaranteeColors: Record<string, string> = {
  proof_pending: 'bg-[#FFF3E0] text-sienna',
  proof_passed: 'bg-sage-light text-forest',
  proof_failed_refund_review: 'bg-[#FDEAE4] text-sienna',
  recovery_pending: 'bg-[#FFF3E0] text-sienna',
  recovery_passed: 'bg-sage-light text-forest',
  recovery_failed_refund_review: 'bg-[#FDEAE4] text-sienna',
};

const timelineStateLabel: Record<string, string> = {
  pending: 'Pending',
  active: 'Active',
  completed: 'Done',
  failed: 'Failed',
};

export function AdminSubscriptionTable() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/billing/subscriptions');
        if (res.ok) {
          const data = (await res.json()) as { subscriptions: SubscriptionRow[] };
          setSubscriptions(data.subscriptions || []);
        }
      } catch (err) {
        console.error('Failed to load subscriptions:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          All Subscriptions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading...</p>
        ) : subscriptions.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No subscriptions yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead>Renews</TableHead>
                <TableHead>Guarantee</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{sub.clientName}</TableCell>
                  <TableCell>{sub.planName}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[sub.status] || 'bg-muted text-foreground'}>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    ${(sub.priceMonthly / 100).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {sub.currentPeriodEnd
                      ? format(new Date(sub.currentPeriodEnd), 'MMM d, yyyy')
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge
                        className={
                          guaranteeColors[sub.guarantee.status] || 'bg-muted text-foreground'
                        }
                      >
                        {sub.guarantee.statusLabel}
                      </Badge>
                      {sub.guarantee.proofWindow.startAt && sub.guarantee.proofWindow.adjustedEndAt && (
                        <span className="text-xs text-muted-foreground">
                          Proof {format(new Date(sub.guarantee.proofWindow.startAt), 'MMM d')} - {format(new Date(sub.guarantee.proofWindow.adjustedEndAt), 'MMM d')}
                        </span>
                      )}
                      {sub.guarantee.recoveryWindow.startAt && sub.guarantee.recoveryWindow.adjustedEndAt && (
                        <span className="text-xs text-muted-foreground">
                          Recovery {format(new Date(sub.guarantee.recoveryWindow.startAt), 'MMM d')} - {format(new Date(sub.guarantee.recoveryWindow.adjustedEndAt), 'MMM d')}
                        </span>
                      )}
                      {sub.guarantee.timeline.map((item) => (
                        <span key={item.key} className="text-xs text-muted-foreground">
                          {item.label}: {timelineStateLabel[item.state]} ({item.detail})
                        </span>
                      ))}
                      {sub.guarantee.extension.adjusted && (
                        <span className="text-xs text-muted-foreground">
                          Extension x{sub.guarantee.extension.factorMultiplier.toFixed(2)}
                          {sub.guarantee.extension.observedMonthlyLeadAverage !== null
                            ? ` (${sub.guarantee.extension.observedMonthlyLeadAverage}/mo)`
                            : ''}
                        </span>
                      )}
                      {sub.guarantee.refundReviewRequired && sub.guarantee.refundEligibleAt && (
                        <span className="text-xs text-muted-foreground">
                          Refund review flagged {format(new Date(sub.guarantee.refundEligibleAt), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {sub.createdAt
                      ? format(new Date(sub.createdAt), 'MMM d, yyyy')
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
