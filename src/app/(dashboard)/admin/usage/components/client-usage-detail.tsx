'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, AlertTriangle, Check } from 'lucide-react';
import Link from 'next/link';

interface UsageDetail {
  totalCostCents: number;
  byService: Record<string, number>;
  byDay: Array<{ date: string; costCents: number }>;
  topOperations: Array<{ operation: string; costCents: number; requests: number }>;
  currentMonth: {
    costCents: number;
    daysRemaining: number;
    projectedCostCents: number;
  };
  alerts: Array<{
    id: string;
    alertType: string;
    severity: string;
    message: string;
    createdAt: string;
  }>;
}

interface Props {
  clientId: string;
  clientName: string;
}

export function ClientUsageDetail({ clientId, clientName }: Props) {
  const [data, setData] = useState<UsageDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/usage/${clientId}`)
      .then(r => r.json() as Promise<UsageDetail>)
      .then(setData)
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAcknowledgeAlert = async (alertId: string) => {
    await fetch(`/api/admin/usage/alerts/${alertId}/acknowledge`, {
      method: 'POST',
    });
    fetchData();
  };

  const formatCost = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!data) {
    return <div className="text-center py-8">No data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/usage">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{clientName}</h1>
          <p className="text-muted-foreground">Usage & Cost Details</p>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Active Alerts ({data.alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.alerts.map(alert => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                    {alert.severity}
                  </Badge>
                  <span>{alert.message}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAcknowledgeAlert(alert.id)}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Acknowledge
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Current Month Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Month to Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCost(data.currentMonth.costCents)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Projected Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCost(data.currentMonth.projectedCostCents)}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.currentMonth.daysRemaining} days remaining
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCost(Math.round(data.totalCostCents / (data.byDay.length || 1)))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost by Service */}
      <Card>
        <CardHeader>
          <CardTitle>Cost by Service</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(data.byService).length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">No service usage data</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(data.byService)
                .sort(([, a], [, b]) => b - a)
                .map(([service, costCents]) => {
                  const percent = data.totalCostCents > 0
                    ? Math.round((costCents / data.totalCostCents) * 100)
                    : 0;
                  return (
                    <div key={service}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="capitalize">{service.replace(/_/g, ' ')}</span>
                        <span className="font-medium">{formatCost(costCents)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Top Operations</CardTitle>
        </CardHeader>
        <CardContent>
          {data.topOperations.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">No operation data</p>
          ) : (
            <div className="space-y-2">
              {data.topOperations.map(op => (
                <div
                  key={op.operation}
                  className="flex items-center justify-between p-2 rounded border"
                >
                  <div>
                    <span className="font-medium">{op.operation}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({op.requests.toLocaleString()} calls)
                    </span>
                  </div>
                  <span className="font-medium">{formatCost(op.costCents)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
