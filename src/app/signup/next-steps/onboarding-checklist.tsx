'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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

// Maps each step key to the settings page (or relevant portal page) that resolves it.
const STEP_ACTION_HREF: Record<string, string> = {
  phone_provisioned: '/client/settings?tab=phone',
  missed_call_text_back_live: '/client/settings?tab=features',
  call_your_number_proof: '/client/settings?tab=phone',
  revenue_leak_audit_delivered: '/client/settings',
  business_hours: '/client/settings',
  knowledge_base: '/client/settings',
  team_access: '/client/settings',
};

const STEP_ACTION_LABEL: Record<string, string> = {
  phone_provisioned: 'Set up phone',
  missed_call_text_back_live: 'Enable features',
  call_your_number_proof: 'Go to phone settings',
  revenue_leak_audit_delivered: 'View settings',
  business_hours: 'Configure hours',
  knowledge_base: 'Add knowledge',
  team_access: 'Invite team',
};

// Maps tutorial slugs to specific portal pages when they exist.
const TUTORIAL_HREF: Record<string, string> = {
  'set-up-phone': '/client/settings?tab=phone',
  'configure-ai': '/client/settings?tab=ai',
  'notifications': '/client/settings?tab=notifications',
  'features': '/client/settings?tab=features',
};

function getTutorialHref(slug: string): string {
  return TUTORIAL_HREF[slug] ?? `/client/help/${slug}`;
}

function getFirstIncompleteStep(steps: Step[]): Step | null {
  return steps.find((s) => !s.done) ?? null;
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

  // Derive the single most important next action from incomplete steps.
  function getStartHereStep(steps: Step[]): Step | null {
    // Priority order mirrors the step keys in the API.
    const priorityOrder = [
      'phone_provisioned',
      'missed_call_text_back_live',
      'business_hours',
      'knowledge_base',
      'team_access',
      'call_your_number_proof',
      'revenue_leak_audit_delivered',
    ];
    for (const key of priorityOrder) {
      const step = steps.find((s) => s.key === key && !s.done);
      if (step) return step;
    }
    return getFirstIncompleteStep(steps);
  }

  // Derive a simplified quality gate status: ready or first actionable reason.
  function getQualityStatus(quality: OnboardingQualityState): {
    ready: boolean;
    reason: string | null;
  } {
    if (quality.evaluation.passedAll) {
      return { ready: true, reason: null };
    }
    const firstAction = quality.evaluation.recommendedActions[0];
    const reason = firstAction?.action ?? 'Review your setup steps above';
    return { ready: false, reason };
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

            {/* Start Here — single most important next action */}
            {(() => {
              const next = getStartHereStep(state.steps);
              if (!next) return null;
              const href = STEP_ACTION_HREF[next.key] ?? '/client/settings';
              const label = STEP_ACTION_LABEL[next.key] ?? 'Complete this step';
              return (
                <div className="rounded-md border-l-4 border-l-[#C15B2E] bg-[#FDEAE4] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#C15B2E] mb-1">
                    Start Here
                  </p>
                  <p className="text-sm font-medium text-[#1B2F26]">{next.title}</p>
                  <Link
                    href={href}
                    className="mt-2 inline-block text-sm font-medium text-[#C15B2E] underline underline-offset-2 hover:opacity-80"
                  >
                    {label} &rarr;
                  </Link>
                </div>
              );
            })()}

            {/* Setup steps */}
            <div className="space-y-2">
              {state.steps.map((step) => {
                const href = STEP_ACTION_HREF[step.key];
                const label = STEP_ACTION_LABEL[step.key] ?? 'Complete';
                return (
                  <div
                    key={step.key}
                    className="flex items-center justify-between rounded border px-3 py-2"
                  >
                    <span className="text-sm">{step.title}</span>
                    {step.done ? (
                      <span className="text-sm text-[#3D7A50]">Done</span>
                    ) : href ? (
                      <Link
                        href={href}
                        className="text-sm font-medium text-[#C15B2E] underline underline-offset-2 hover:opacity-80"
                      >
                        {label} &rarr;
                      </Link>
                    ) : (
                      <span className="text-sm text-[#C15B2E]">Pending</span>
                    )}
                  </div>
                );
              })}
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
                      <span className="text-sm">{milestone.title}</span>
                      <div className="flex items-center gap-2">
                        {milestone.key === 'number_live' && milestone.status !== 'completed' && (
                          <Link
                            href="/client/settings?tab=phone"
                            className="text-xs text-[#6B7E54] underline hover:opacity-80"
                          >
                            Set up in portal &rarr;
                          </Link>
                        )}
                        <span
                          className={
                            milestone.status === 'completed'
                              ? 'text-sm text-[#3D7A50]'
                              : milestone.status === 'overdue'
                                ? 'text-sm text-destructive'
                                : 'text-sm text-[#C15B2E]'
                          }
                        >
                          {milestone.status === 'completed'
                            ? 'Done'
                            : milestone.status === 'overdue'
                              ? 'Overdue'
                              : 'Pending'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {state.dayOne.audit?.status === 'delivered' && (
                  <div className="rounded border px-3 py-2 text-sm">
                    <p className="font-medium">Revenue Leak Audit Delivered</p>
                    {state.dayOne.audit.deliveredAt && (
                      <p className="text-muted-foreground">
                        Delivered: {state.dayOne.audit.deliveredAt}
                      </p>
                    )}
                    {state.dayOne.audit.summary && (
                      <p className="text-muted-foreground">{state.dayOne.audit.summary}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quality gates — simplified, hidden when all pass */}
            {state.onboardingQuality && (() => {
              const { ready, reason } = getQualityStatus(state.onboardingQuality);
              if (ready) return null;
              return (
                <div className="rounded-md border border-[#C15B2E]/30 bg-[#FFF3E0] px-4 py-3">
                  <p className="text-sm font-medium text-[#C15B2E]">Action needed</p>
                  {reason && (
                    <p className="mt-1 text-sm text-[#1B2F26]">{reason}</p>
                  )}
                </div>
              );
            })()}

            {/* Tutorial track — clickable links */}
            {state.tutorials.length > 0 && (
              <div>
                <p className="font-medium mb-2">Tutorials</p>
                <ul className="space-y-1">
                  {state.tutorials.map((t) => (
                    <li key={t.slug}>
                      <Link
                        href={getTutorialHref(t.slug)}
                        className="text-sm text-[#6B7E54] underline underline-offset-2 hover:opacity-80"
                      >
                        {t.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
