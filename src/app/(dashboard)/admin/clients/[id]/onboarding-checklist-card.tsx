'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface ChecklistItem {
  key: string;
  label: string;
  completed: boolean;
  blocking: string | null;
  description: string;
}

interface OnboardingChecklistResult {
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  blockedCapabilities: string[];
}

interface Props {
  clientId: string;
}

export function OnboardingChecklistCard({ clientId }: Props) {
  const [data, setData] = useState<OnboardingChecklistResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChecklist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/onboarding-checklist`);
      if (!res.ok) {
        throw new Error(`Failed to load checklist (${res.status})`);
      }
      const json = (await res.json()) as OnboardingChecklistResult;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load checklist');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void fetchChecklist();
  }, [fetchChecklist]);

  if (loading) {
    return (
      <Card className="border-olive/30 bg-moss-light">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Onboarding Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full shrink-0" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-olive/30 bg-moss-light">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Onboarding Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{error ?? 'Unable to load checklist.'}</p>
          <Button size="sm" variant="outline" onClick={() => void fetchChecklist()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const progressPercent =
    data.totalCount > 0
      ? Math.round((data.completedCount / data.totalCount) * 100)
      : 0;

  return (
    <Card className="border-olive/30 bg-moss-light">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Onboarding Checklist</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Blocked capabilities warning */}
        {data.blockedCapabilities.length > 0 && (
          <div className="rounded-md border border-[#C15B2E]/30 bg-[#FDEAE4] px-3 py-2 text-sm text-[#C15B2E]">
            <span className="font-medium">Blocked capabilities: </span>
            {data.blockedCapabilities.join(', ')}
          </div>
        )}

        {/* Progress bar */}
        <div className="space-y-1">
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {data.completedCount} of {data.totalCount} complete
          </p>
        </div>

        {/* Checklist items */}
        <div className="space-y-2 pt-1">
          {data.items.map((item) => {
            const isBlockingIncomplete = !item.completed && item.blocking !== null;

            return (
              <div key={item.key} className="flex items-start gap-2 min-w-0">
                {item.completed ? (
                  <CheckCircle2
                    className="h-4 w-4 mt-0.5 shrink-0"
                    style={{ color: '#3D7A50' }}
                  />
                ) : isBlockingIncomplete ? (
                  <Lock
                    className="h-4 w-4 mt-0.5 shrink-0"
                    style={{ color: '#C15B2E' }}
                  />
                ) : (
                  <Circle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <span
                    className={
                      item.completed
                        ? 'text-sm text-muted-foreground'
                        : 'text-sm'
                    }
                  >
                    {item.label}
                  </span>
                  {isBlockingIncomplete && (
                    <p className="text-xs text-[#C15B2E] mt-0.5">
                      Blocks: {item.blocking}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
