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
}

const statusColors: Record<string, string> = {
  trialing: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  past_due: 'bg-red-100 text-red-800',
  canceled: 'bg-gray-100 text-gray-800',
  unpaid: 'bg-red-100 text-red-800',
  paused: 'bg-yellow-100 text-yellow-800',
};

export function AdminSubscriptionTable() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/billing/subscriptions');
        if (res.ok) {
          const data = await res.json();
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
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{sub.clientName}</TableCell>
                  <TableCell>{sub.planName}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[sub.status] || 'bg-gray-100 text-gray-800'}>
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
