'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface FlowExecutionInfo {
  id: string;
  flowName: string;
  category: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  startedAt: string;
  nextStepAt: string | null;
}

interface FlowStatusProps {
  executions: FlowExecutionInfo[];
}

const statusColors: Record<string, string> = {
  active: 'bg-[#E8F5E9] text-[#3D7A50]',
  paused: 'bg-[#FFF3E0] text-sienna',
  completed: 'bg-sage-light text-forest',
  cancelled: 'bg-muted text-foreground',
};

export function FlowStatus({ executions }: FlowStatusProps) {
  if (executions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Flows</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {executions.map((exec) => {
          const progress = exec.totalSteps > 0
            ? Math.round((exec.currentStep / exec.totalSteps) * 100)
            : 0;

          return (
            <div key={exec.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{exec.flowName}</span>
                <Badge className={statusColors[exec.status] || statusColors.active}>
                  {exec.status}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="capitalize">{exec.category.replace('_', ' ')}</span>
                <span>Step {exec.currentStep}/{exec.totalSteps}</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-primary rounded-full h-1.5 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Started {formatDistanceToNow(new Date(exec.startedAt), { addSuffix: true })}</span>
                {exec.nextStepAt && exec.status === 'active' && (
                  <span>Next: {formatDistanceToNow(new Date(exec.nextStepAt), { addSuffix: true })}</span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
