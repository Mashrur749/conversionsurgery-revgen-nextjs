'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TrendingUp,
  TrendingDown,
  Crown,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

interface TemplateStats {
  templateId: string;
  templateName: string;
  executions: number;
  responseRate: number;
  conversionRate: number;
  optOutRate: number;
}

interface CategoryPerformanceProps {
  category: string;
}

const categoryLabels: Record<string, string> = {
  estimate: 'Estimate Follow-up',
  payment: 'Payment Reminders',
  review: 'Review Requests',
  referral: 'Referral Requests',
  appointment: 'Appointment Reminders',
  missed_call: 'Missed Call Recovery',
  form_response: 'Form Response',
  custom: 'Custom Flows',
};

export function CategoryPerformance({ category }: CategoryPerformanceProps) {
  const [templates, setTemplates] = useState<TemplateStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics/templates?category=${category}&days=${days}`)
      .then((r) => r.json() as Promise<TemplateStats[]>)
      .then((data) => {
        setTemplates(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [category, days]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">Loading...</CardContent>
      </Card>
    );
  }

  if (templates.length === 0) {
    return null;
  }

  // Find best performer
  const bestPerformer = templates.reduce(
    (best, t) => (t.conversionRate > best.conversionRate ? t : best),
    templates[0]
  );

  const totalExecutions = templates.reduce((sum, t) => sum + t.executions, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{categoryLabels[category] || category}</CardTitle>
          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <Button
                key={d}
                variant={days === d ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDays(d)}
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {totalExecutions < 100 && (
          <div className="mb-4 p-3 bg-[#FFF3E0] border border-sienna/30 rounded-lg text-sm text-sienna">
            Low volume ({totalExecutions} executions). Results may not be
            statistically significant.
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead className="text-right">Executions</TableHead>
              <TableHead className="text-right">Response Rate</TableHead>
              <TableHead className="text-right">Conversion Rate</TableHead>
              <TableHead className="text-right">Opt-out Rate</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => {
              const isBest =
                template.templateId === bestPerformer.templateId &&
                totalExecutions >= 100;

              return (
                <TableRow key={template.templateId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isBest && (
                        <Crown className="h-4 w-4 text-sienna" />
                      )}
                      <span className="font-medium">
                        {template.templateName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {template.executions.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricCell
                      value={template.responseRate}
                      baseline={30}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricCell
                      value={template.conversionRate}
                      baseline={10}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricCell
                      value={template.optOutRate}
                      baseline={2}
                      inverse
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link
                        href={`/admin/flow-templates/${template.templateId}`}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {totalExecutions >= 100 && templates.length > 1 && (
          <div className="mt-4 p-4 bg-[#E8F5E9] border border-[#3D7A50]/30 rounded-lg">
            <div className="flex items-center gap-2 text-[#3D7A50]">
              <Crown className="h-5 w-5" />
              <span className="font-medium">
                &quot;{bestPerformer.templateName}&quot; is performing best
              </span>
            </div>
            <p className="text-sm text-[#3D7A50] mt-1">
              {bestPerformer.conversionRate.toFixed(1)}% conversion rate vs
              category average of{' '}
              {(
                templates.reduce((s, t) => s + t.conversionRate, 0) /
                templates.length
              ).toFixed(1)}
              %
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCell({
  value,
  baseline,
  inverse = false,
}: {
  value: number;
  baseline: number;
  inverse?: boolean;
}) {
  const isGood = inverse ? value < baseline : value > baseline;
  const isBad = inverse ? value > baseline * 1.5 : value < baseline * 0.5;

  return (
    <div className="flex items-center justify-end gap-1">
      <span
        className={isBad ? 'text-destructive' : isGood ? 'text-[#3D7A50]' : ''}
      >
        {value.toFixed(1)}%
      </span>
      {isGood && !inverse && (
        <TrendingUp className="h-3 w-3 text-[#3D7A50]" />
      )}
      {isBad && <TrendingDown className="h-3 w-3 text-destructive" />}
    </div>
  );
}
