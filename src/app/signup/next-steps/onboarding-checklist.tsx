'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

interface Step {
  key: string;
  title: string;
  done: boolean;
}

interface DayOneMilestone {
  key: string;
  title: string;
  status: 'pending' | 'completed' | 'overdue';
  targetAt: string;
  completedAt: string | null;
}

interface DayOneState {
  milestones: DayOneMilestone[];
  progress: { completed: number; total: number; percent: number };
  audit: {
    status: 'draft' | 'delivered';
    summary: string | null;
    artifactUrl: string | null;
    deliveredAt: string | null;
  } | null;
}

interface OnboardingQualityGate {
  key: string;
  title: string;
  score: number;
  passed: boolean;
  reasons: string[];
}

interface OnboardingQualityAction {
  gateKey: string;
  action: string;
  impact: 'high' | 'medium' | 'low';
}

interface OnboardingQualityState {
  evaluation: {
    totalScore: number;
    maxScore: number;
    passedCritical: boolean;
    passedAll: boolean;
    gates: OnboardingQualityGate[];
    recommendedActions: OnboardingQualityAction[];
  };
  decision: {
    mode: 'enforce' | 'warn' | 'off';
    allowed: boolean;
    reason: string;
    requiresOverride: boolean;
  };
}

export function OnboardingChecklist() {
  const params = useSearchParams();
  const clientId = params.get('clientId') || '';
  const email = params.get('email') || '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState<{
    businessName: string;
    steps: Step[];
    progress: { completed: number; total: number; percent: number };
    tutorials: { title: string; slug: string }[];
    dayOne: DayOneState | null;
    onboardingQuality: OnboardingQualityState | null;
  } | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  const canLoad = useMemo(() => !!clientId && !!email, [clientId, email]);

  const loadStatus = useCallback(async () => {
    if (!clientId || !email) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/public/onboarding/status?clientId=${clientId}&email=${encodeURIComponent(email)}`);
      const data = (await res.json()) as {
        error?: string;
        client?: { businessName: string };
        steps?: Step[];
        progress?: { completed: number; total: number; percent: number };
        tutorials?: { title: string; slug: string }[];
        dayOne?: DayOneState;
        onboardingQuality?: OnboardingQualityState | null;
      };

      if (!res.ok) {
        setError(data.error || 'Failed to load onboarding status');
        return;
      }

      setState({
        businessName: data.client?.businessName || 'Your Business',
        steps: data.steps || [],
        progress: data.progress || { completed: 0, total: 0, percent: 0 },
        tutorials: data.tutorials || [],
        dayOne: data.dayOne || null,
        onboardingQuality: data.onboardingQuality || null,
      });
    } catch {
      setError('Failed to load onboarding status');
    } finally {
      setLoading(false);
    }
  }, [clientId, email]);

  // Auto-load when both params are present (normal signup redirect flow)
  useEffect(() => {
    if (canLoad) {
      loadStatus();
    }
  }, [canLoad, loadStatus]);

  async function requestSetupHelp() {
    if (!canLoad) return;
    setError('');
    try {
      const res = await fetch('/api/public/onboarding/request-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          email,
          message: requestMessage,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error || 'Failed to request setup help');
        return;
      }

      setRequestSent(true);
    } catch {
      setError('Failed to request setup help');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Self-Serve Onboarding Checklist</CardTitle>
        <CardDescription>
          Track your workspace setup progress and get help when you need it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={loadStatus} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        )}

        {loading && !state && (
          <div className="space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          </div>
        )}

        {!canLoad && !loading && (
          <p className="text-sm text-muted-foreground">
            Missing setup link parameters. Use the link from your signup confirmation.
          </p>
        )}

        {state && (
          <div className="space-y-4 border rounded-md p-4">
            <div>
              <p className="font-medium">{state.businessName}</p>
              <p className="text-sm text-muted-foreground">
                Progress: {state.progress.completed}/{state.progress.total} ({state.progress.percent}%)
              </p>
            </div>

            <div className="space-y-2">
              {state.steps.map((step) => (
                <div key={step.key} className="flex items-center justify-between rounded border px-3 py-2">
                  <span>{step.title}</span>
                  <span className={step.done ? 'text-forest' : 'text-sienna'}>
                    {step.done ? 'Done' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>

            {state.dayOne && (
              <div className="space-y-2 rounded border p-3">
                <p className="font-medium">Day-One Activation</p>
                <p className="text-sm text-muted-foreground">
                  {state.dayOne.progress.completed}/{state.dayOne.progress.total} milestones complete
                  {' '}({state.dayOne.progress.percent}%)
                </p>
                <div className="space-y-2">
                  {state.dayOne.milestones.map((milestone) => (
                    <div
                      key={milestone.key}
                      className="flex items-center justify-between rounded border px-3 py-2"
                    >
                      <span>{milestone.title}</span>
                      <div className="flex items-center gap-2">
                        {milestone.key === 'number_live' && milestone.status !== 'completed' && (
                          <a
                            href="/client/settings/phone"
                            className="text-xs text-olive underline hover:text-olive/80"
                          >
                            Set up in portal &rarr;
                          </a>
                        )}
                        <span
                          className={
                            milestone.status === 'completed'
                              ? 'text-forest'
                              : milestone.status === 'overdue'
                                ? 'text-destructive'
                                : 'text-sienna'
                          }
                        >
                          {milestone.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {state.dayOne.audit?.status === 'delivered' && (
                  <div className="rounded border px-3 py-2 text-sm">
                    <p className="font-medium">Revenue Leak Audit Delivered</p>
                    <p className="text-muted-foreground">
                      Delivered at: {state.dayOne.audit.deliveredAt || 'n/a'}
                    </p>
                    {state.dayOne.audit.summary && (
                      <p className="text-muted-foreground">{state.dayOne.audit.summary}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {state.onboardingQuality && (
              <div className="space-y-2 rounded border p-3">
                <p className="font-medium">Production Readiness Quality Gates</p>
                <p className="text-sm text-muted-foreground">
                  Score {state.onboardingQuality.evaluation.totalScore}/{state.onboardingQuality.evaluation.maxScore}
                  {' '}· Policy mode: {state.onboardingQuality.decision.mode}
                </p>
                <div className="space-y-2">
                  {state.onboardingQuality.evaluation.gates.map((gate) => (
                    <div key={gate.key} className="flex items-center justify-between rounded border px-3 py-2">
                      <div>
                        <p>{gate.title}</p>
                        {!gate.passed && gate.reasons[0] && (
                          <p className="text-xs text-muted-foreground">{gate.reasons[0]}</p>
                        )}
                      </div>
                      <span className={gate.passed ? 'text-forest' : 'text-sienna'}>
                        {gate.passed ? 'Pass' : 'Fix'} ({gate.score}/100)
                      </span>
                    </div>
                  ))}
                </div>

                {state.onboardingQuality.evaluation.recommendedActions.length > 0 && (
                  <div className="rounded border px-3 py-2">
                    <p className="text-sm font-medium">What to fix next</p>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground">
                      {state.onboardingQuality.evaluation.recommendedActions.slice(0, 3).map((action, index) => (
                        <li key={`${action.gateKey}-${index}`}>
                          [{action.impact}] {action.action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="font-medium mb-2">Tutorial Track</p>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {state.tutorials.map((t) => (
                  <li key={t.slug}>{t.title}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="setupHelp">Need help?</Label>
              <Input
                id="setupHelp"
                placeholder="Add context for your setup request (optional)"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
              />
              <Button onClick={requestSetupHelp} variant="outline" disabled={requestSent}>
                {requestSent ? 'Request Sent' : 'Request Managed Onboarding Help'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
