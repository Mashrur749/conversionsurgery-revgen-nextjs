'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

type PolicyMode = 'enforce' | 'warn' | 'off';

interface GateResult {
  key: string;
  title: string;
  score: number;
  passed: boolean;
  critical: boolean;
  reasons: string[];
}

interface ActionItem {
  gateKey: string;
  action: string;
  impact: 'high' | 'medium' | 'low';
}

interface ReadinessPayload {
  success: boolean;
  evaluation: {
    totalScore: number;
    maxScore: number;
    passedCritical: boolean;
    passedAll: boolean;
    criticalFailures: string[];
    gates: GateResult[];
    recommendedActions: ActionItem[];
  };
  decision: {
    mode: PolicyMode;
    allowed: boolean;
    reason: string;
    requiresOverride: boolean;
  };
  override: {
    id: string;
    reason: string;
    approvedAt: string;
    expiresAt: string | null;
    allowAutonomousMode: boolean;
  } | null;
}

interface Props {
  clientId: string;
  currentAiMode: 'off' | 'assist' | 'autonomous';
}

function impactBadgeClass(impact: ActionItem['impact']) {
  if (impact === 'high') return 'bg-[#FDEAE4] text-[#C15B2E] border-[#C15B2E]/20';
  if (impact === 'medium') return 'bg-[#FFF3E0] text-[#C15B2E] border-[#C15B2E]/20';
  return 'bg-muted text-muted-foreground border-border';
}

export function OnboardingQualityPanel({ clientId, currentAiMode }: Props) {
  const [data, setData] = useState<ReadinessPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [enableNow, setEnableNow] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/onboarding/quality`);
      const payload = (await res.json()) as ReadinessPayload & { error?: string };
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || `Failed to load onboarding quality (${res.status})`);
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load onboarding quality');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [clientId]);

  async function runAction(body: Record<string, unknown>) {
    setError('');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/onboarding/quality`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as ReadinessPayload & { error?: string };
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || `Failed (${res.status})`);
      }
      setData(payload);
      if (body.action === 'set_override') {
        setOverrideReason('');
        setEnableNow(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Onboarding Quality Gates</CardTitle>
        <CardDescription>
          Production-readiness gates for autonomous AI mode.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-[#C15B2E]/20 bg-[#FDEAE4] px-3 py-2 text-sm text-[#C15B2E]">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading gate status...</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">No onboarding quality data.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Score {data.evaluation.totalScore}/{data.evaluation.maxScore}</Badge>
              <Badge variant="outline">Mode {data.decision.mode}</Badge>
              <Badge className={data.evaluation.passedCritical ? 'bg-[#E8F5E9] text-[#3D7A50] border-[#3D7A50]/20' : 'bg-[#FDEAE4] text-[#C15B2E] border-[#C15B2E]/20'}>
                {data.evaluation.passedCritical ? 'Critical Gates Pass' : 'Critical Gates Failing'}
              </Badge>
              {currentAiMode === 'autonomous' && (
                <Badge className="bg-[#E3E9E1] text-[#1B2F26] border-[#1B2F26]/20">
                  AI Mode: Autonomous
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              {data.evaluation.gates.map((gate) => (
                <div key={gate.key} className="rounded border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{gate.title}</p>
                    <span className={gate.passed ? 'text-forest' : 'text-sienna'}>
                      {gate.passed ? 'Pass' : 'Fail'} ({gate.score}/100)
                    </span>
                  </div>
                  {!gate.passed && gate.reasons.length > 0 && (
                    <ul className="list-disc pl-5 text-sm text-muted-foreground mt-1">
                      {gate.reasons.map((reason, idx) => (
                        <li key={`${gate.key}-${idx}`}>{reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {data.evaluation.recommendedActions.length > 0 && (
              <div className="rounded border p-3 space-y-2">
                <p className="font-medium">What to fix next</p>
                {data.evaluation.recommendedActions.slice(0, 5).map((action, idx) => (
                  <div key={`${action.gateKey}-${idx}`} className="flex items-start justify-between gap-2">
                    <p className="text-sm">{action.action}</p>
                    <Badge className={impactBadgeClass(action.impact)}>
                      {action.impact}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void runAction({ action: 'reevaluate' })} disabled={isPending}>
                Re-evaluate
              </Button>
              {data.override && (
                <Button
                  variant="outline"
                  onClick={() => void runAction({ action: 'clear_override', reason: 'Cleared by operator' })}
                  disabled={isPending}
                >
                  Clear Override
                </Button>
              )}
            </div>

            {data.override && (
              <div className="rounded border p-3 text-sm">
                <p className="font-medium">Active override</p>
                <p className="text-muted-foreground">{data.override.reason}</p>
                <p className="text-muted-foreground">
                  Approved at: {new Date(data.override.approvedAt).toLocaleString('en-CA')}
                </p>
              </div>
            )}

            {!data.evaluation.passedCritical && data.decision.mode === 'enforce' && (
              <div className="rounded border p-3 space-y-2">
                <Label htmlFor="overrideReason">Override reason (required)</Label>
                <Input
                  id="overrideReason"
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  placeholder="Document why autonomous mode is allowed despite failed gates"
                />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="enableNow"
                    checked={enableNow}
                    onCheckedChange={(checked) => setEnableNow(checked === true)}
                  />
                  <Label htmlFor="enableNow" className="text-sm">
                    Also enable autonomous mode now
                  </Label>
                </div>
                <Button
                  onClick={() =>
                    void runAction({
                      action: 'set_override',
                      reason: overrideReason,
                      allowAutonomousMode: true,
                      enableAutonomousModeNow: enableNow,
                    })
                  }
                  disabled={overrideReason.trim().length < 10 || isPending}
                >
                  Approve Override
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
