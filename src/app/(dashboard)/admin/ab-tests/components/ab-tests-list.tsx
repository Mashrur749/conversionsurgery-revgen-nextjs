'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowRight, BarChart3 } from 'lucide-react';
import type { ABTest } from '@/db/schema';

interface TestWithClient extends ABTest {
  clientName: string;
  clientEmail: string;
}

interface Props {
  title: string;
  tests: TestWithClient[];
  status: 'active' | 'paused' | 'completed';
}

export function ABTestsList({ title, tests, status }: Props) {
  const getTestTypeLabel = (testType: string) => {
    const labels: Record<string, string> = {
      messaging: '💬 Messaging',
      timing: '⏰ Timing',
      team: '👥 Team',
      sequence: '🔄 Sequence',
    };
    return labels[testType] || testType;
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-amber-100 text-amber-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0 divide-y">
          {tests.map((test) => (
            <div key={test.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{test.name}</h3>
                    <Badge className={getStatusColor(test.status || 'active')}>
                      {test.status || 'active'}
                    </Badge>
                    <Badge variant="outline">
                      {getTestTypeLabel(test.testType)}
                    </Badge>
                    {test.winner && (
                      <Badge className="bg-green-100 text-green-800">
                        Winner: {test.winner}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {test.clientName} • {test.clientEmail}
                  </p>
                  {test.description && (
                    <p className="text-sm mt-2">{test.description}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Started</p>
                  <p className="font-medium">
                    {format(test.startDate as Date, 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <p className="font-medium capitalize">{test.status}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Duration
                  </p>
                  <p className="font-medium">
                    {test.endDate
                      ? Math.ceil(
                          ((test.endDate as Date).getTime() - (test.startDate as Date).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )
                      : 'Ongoing'}{' '}
                    days
                  </p>
                </div>
              </div>

              <Button asChild size="sm">
                <Link href={`/admin/ab-tests/${test.id}`}>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Results
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
