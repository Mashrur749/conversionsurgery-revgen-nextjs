'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DollarSign,
  MessageSquare,
  Bot,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import Link from 'next/link';

interface UsageData {
  month: string;
  clients: Array<{
    clientId: string;
    clientName: string;
    totalCost: number;
    openaiCost: number;
    twilioSmsCost: number;
    totalMessages: number;
    totalAiCalls: number;
    costChange: number | null;
  }>;
  totals: {
    totalCost: number;
    openaiCost: number;
    twilioSmsCost: number;
    totalMessages: number;
    totalAiCalls: number;
  };
}

export function UsageDashboard() {
  const [data, setData] = useState<UsageData | null>(null);
  const [month, setMonth] = useState(getCurrentMonth());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/usage?month=${month}`)
      .then(r => r.json() as Promise<UsageData>)
      .then(setData)
      .finally(() => setLoading(false));
  }, [month]);

  const formatCost = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const months = getLast6Months();

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">API Usage & Costs</h2>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCost(data.totals.totalCost)}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.clients.length} active clients
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">OpenAI</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCost(data.totals.openaiCost)}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.totals.totalAiCalls.toLocaleString()} calls
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Twilio SMS</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCost(data.totals.twilioSmsCost)}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.totals.totalMessages.toLocaleString()} messages
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg per Client</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCost(data.clients.length ? data.totals.totalCost / data.clients.length : 0)}
              </div>
              <p className="text-xs text-muted-foreground">per month</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Client breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle>Usage by Client</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !data?.clients.length ? (
            <div className="text-center py-8 text-muted-foreground">No usage data for this month</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">OpenAI</TableHead>
                  <TableHead className="text-right">SMS</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">vs Last Month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.clients.map(client => (
                  <TableRow key={client.clientId}>
                    <TableCell>
                      <Link
                        href={`/admin/usage/${client.clientId}`}
                        className="font-medium hover:underline"
                      >
                        {client.clientName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCost(client.openaiCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCost(client.twilioSmsCost)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCost(client.totalCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {client.costChange !== null && (
                        <Badge
                          variant={client.costChange > 20 ? 'destructive' : 'secondary'}
                          className="gap-1"
                        >
                          {client.costChange > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {client.costChange > 0 ? '+' : ''}{client.costChange}%
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getLast6Months(): Array<{ value: string; label: string }> {
  const months = [];
  const now = new Date();

  for (let i = 0; i < 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    months.push({ value, label });
  }

  return months;
}
