'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp } from 'lucide-react';

interface MetricsData {
  messagesSent: number;
  messagesDelivered: number;
  conversationsStarted: number;
  appointmentsBooked: number;
  formsResponded: number;
  leadsQualified: number;
  estimatesFollowedUp: number;
  conversionsCompleted: number;
  deliveryRate: number;
  engagementRate: number;
  conversionRate: number;
  appointmentRate: number;
}

interface ResultsData {
  success: boolean;
  test: {
    status: string;
  };
  variants: {
    A: MetricsData;
    B: MetricsData;
  };
  performance: {
    winner: string;
    improvement: string;
  };
}

interface Props {
  testId: string;
  status: string;
}

export function TestResultsCard({ testId, status }: Props) {
  const [results, setResults] = useState<ResultsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch(`/api/admin/ab-tests/${testId}/results`);
        const data = (await res.json()) as ResultsData;

        if (!res.ok) {
          setError('Failed to load test results');
          return;
        }

        setResults(data);
      } catch (err: any) {
        console.error('Fetch results error:', err);
        setError('Failed to load test results');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [testId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Loading results...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !results) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-red-600">
          {error || 'Failed to load results'}
        </CardContent>
      </Card>
    );
  }

  const { variants, performance } = results;
  const variantA = variants.A;
  const variantB = variants.B;

  const MetricComparison = ({
    label,
    valueA,
    valueB,
  }: {
    label: string;
    valueA: number | string;
    valueB: number | string;
  }) => {
    const aNum = typeof valueA === 'string' ? parseFloat(valueA) : valueA;
    const bNum = typeof valueB === 'string' ? parseFloat(valueB) : valueB;
    const isB = bNum > aNum;

    return (
      <div className="border-b pb-4 last:border-b-0">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium">{label}</p>
          {isB && (
            <Badge className="bg-green-100 text-green-800">
              <TrendingUp className="w-3 h-3 mr-1" /> Variant B wins
            </Badge>
          )}
          {!isB && aNum > 0 && (
            <Badge className="bg-blue-100 text-blue-800">Variant A leads</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-3 rounded">
            <p className="text-xs text-blue-600 font-medium mb-1">Variant A</p>
            <p className="font-semibold">
              {typeof valueA === 'number'
                ? valueA.toFixed(1)
                : parseFloat(valueA).toFixed(1)}
              {typeof valueA === 'string' ? '%' : ''}
            </p>
          </div>
          <div className="bg-amber-50 p-3 rounded">
            <p className="text-xs text-amber-600 font-medium mb-1">Variant B</p>
            <p className="font-semibold">
              {typeof valueB === 'number'
                ? valueB.toFixed(1)
                : parseFloat(valueB).toFixed(1)}
              {typeof valueB === 'string' ? '%' : ''}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Test Results
          </CardTitle>
          {status === 'completed' && (
            <Badge className="bg-green-100 text-green-800">
              Completed • Winner: {performance.winner}
            </Badge>
          )}
          {status === 'active' && (
            <Badge className="bg-blue-100 text-blue-800">
              {performance.improvement.includes('-') ? '−' : '+'}
              {Math.abs(parseFloat(performance.improvement))}% Improvement
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <MetricComparison
          label="Messages Sent"
          valueA={variantA.messagesSent}
          valueB={variantB.messagesSent}
        />

        <MetricComparison
          label="Delivery Rate"
          valueA={variantA.deliveryRate}
          valueB={variantB.deliveryRate}
        />

        <MetricComparison
          label="Engagement Rate"
          valueA={variantA.engagementRate}
          valueB={variantB.engagementRate}
        />

        <MetricComparison
          label="Conversations Started"
          valueA={variantA.conversationsStarted}
          valueB={variantB.conversationsStarted}
        />

        <MetricComparison
          label="Conversion Rate"
          valueA={variantA.conversionRate}
          valueB={variantB.conversionRate}
        />

        <MetricComparison
          label="Conversions Completed"
          valueA={variantA.conversionsCompleted}
          valueB={variantB.conversionsCompleted}
        />

        <MetricComparison
          label="Appointments Booked"
          valueA={variantA.appointmentsBooked}
          valueB={variantB.appointmentsBooked}
        />

        <MetricComparison
          label="Appointment Rate"
          valueA={variantA.appointmentRate}
          valueB={variantB.appointmentRate}
        />

        <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
          <p className="text-sm text-muted-foreground mb-2">
            Overall Performance
          </p>
          <p className="text-lg font-semibold">
            Variant {performance.winner} is winning with{' '}
            <span className="text-green-600">
              +{Math.abs(parseFloat(performance.improvement))}%
            </span>{' '}
            improvement in conversion rate
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
