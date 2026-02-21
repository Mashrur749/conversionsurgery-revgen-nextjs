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
  guaranteeStatus: string | null;
  guaranteeEndsAt: string | null;
  guaranteeRefundEligibleAt: string | null;
  priceMonthly: number;
  currentPeriodEnd: string | null;
  createdAt: string;
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
  pending: 'bg-[#FFF3E0] text-sienna',
  fulfilled: 'bg-sage-light text-forest',
  refund_review_required: 'bg-[#FDEAE4] text-sienna',
  refunded: 'bg-muted text-foreground',
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
                      <Badge className={guaranteeColors[sub.guaranteeStatus || 'pending'] || 'bg-muted text-foreground'}>
                        {sub.guaranteeStatus || 'pending'}
                      </Badge>
                      {sub.guaranteeStatus === 'pending' && sub.guaranteeEndsAt && (
                        <span className="text-xs text-muted-foreground">
                          Ends {format(new Date(sub.guaranteeEndsAt), 'MMM d')}
                        </span>
                      )}
                      {sub.guaranteeStatus === 'refund_review_required' && sub.guaranteeRefundEligibleAt && (
                        <span className="text-xs text-muted-foreground">
                          Flagged {format(new Date(sub.guaranteeRefundEligibleAt), 'MMM d')}
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
