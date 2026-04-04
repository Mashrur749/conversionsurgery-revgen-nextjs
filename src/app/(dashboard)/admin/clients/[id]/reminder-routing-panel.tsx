'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ReminderType = 'appointment_reminder_contractor' | 'booking_notification';
type Role = 'owner' | 'assistant' | 'escalation_team' | 'any_active_member';

interface Rule {
  primaryRole: Role;
  fallbackRoles: Role[];
  secondaryRoles: Role[];
}

interface Step {
  role: Role;
  missing: boolean;
  recipient: {
    label: string;
    phone: string;
  } | null;
}

interface ReminderRoutingPayload {
  success: boolean;
  policy: Record<ReminderType, Rule>;
  previews: Record<ReminderType, {
    rule: Rule;
    primarySteps: Step[];
    secondarySteps: Step[];
  }>;
  history: Array<{
    id: string;
    action: string;
    createdAt: string;
    actorName: string | null;
    metadata: unknown;
  }>;
}

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: 'owner', label: 'Owner' },
  { value: 'assistant', label: 'Assistant / Office' },
  { value: 'escalation_team', label: 'Escalation Team' },
  { value: 'any_active_member', label: 'Any Active Member' },
];

const REMINDER_LABELS: Record<ReminderType, string> = {
  appointment_reminder_contractor: 'Appointment Reminder (Internal)',
  booking_notification: 'Booking Notification',
};

function roleLabel(role: Role): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

function updateRoleAt(roles: Role[], index: number, next: string): Role[] {
  const cleaned = [...roles];
  if (next === 'none') {
    cleaned.splice(index, 1);
    return cleaned;
  }
  cleaned[index] = next as Role;
  return cleaned.filter((value, idx) => cleaned.indexOf(value) === idx);
}

export function ReminderRoutingPanel({ clientId }: { clientId: string }) {
  const [data, setData] = useState<ReminderRoutingPayload | null>(null);
  const [policyDraft, setPolicyDraft] = useState<Record<ReminderType, Rule> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const canSave = useMemo(() => policyDraft !== null, [policyDraft]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/reminder-routing`);
      const payload = (await response.json()) as ReminderRoutingPayload & { error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || `Failed to load reminder routing (${response.status})`);
      }
      setData(payload);
      setPolicyDraft(payload.policy);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load reminder routing');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [clientId]);

  async function save() {
    if (!policyDraft) return;
    setError('');
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/reminder-routing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: policyDraft }),
      });
      const payload = (await response.json()) as ReminderRoutingPayload & { error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || `Failed to save routing policy (${response.status})`);
      }
      setData(payload);
      setPolicyDraft(payload.policy);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save routing policy');
    }
  }

  function updateRule(reminderType: ReminderType, updater: (rule: Rule) => Rule) {
    setPolicyDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        [reminderType]: updater(current[reminderType]),
      };
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reminder Routing Policy</CardTitle>
        <CardDescription>
          Configure recipient routing, fallback order, and optional secondary recipients by reminder type.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-[#C15B2E]/20 bg-[#FDEAE4] px-3 py-2 text-sm text-[#C15B2E]">
            {error}
          </div>
        )}

        {loading || !policyDraft || !data ? (
          <p className="text-sm text-muted-foreground">Loading reminder routing settings...</p>
        ) : (
          <>
            {(Object.keys(policyDraft) as ReminderType[]).map((reminderType) => {
              const rule = policyDraft[reminderType];
              const preview = data.previews[reminderType];
              const fallback1 = rule.fallbackRoles[0] ?? 'none';
              const fallback2 = rule.fallbackRoles[1] ?? 'none';
              const secondary1 = rule.secondaryRoles[0] ?? 'none';

              return (
                <div key={reminderType} className="rounded border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{REMINDER_LABELS[reminderType]}</p>
                    <Badge variant="outline">
                      {preview.primarySteps.filter((step) => !step.missing).length} recipient(s) resolvable
                    </Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Primary recipient role</Label>
                      <Select
                        value={rule.primaryRole}
                        onValueChange={(value) =>
                          updateRule(reminderType, (current) => ({
                            ...current,
                            primaryRole: value as Role,
                            fallbackRoles: current.fallbackRoles.filter((role) => role !== value),
                            secondaryRoles: current.secondaryRoles.filter((role) => role !== value),
                          }))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Fallback role #1</Label>
                      <Select
                        value={fallback1}
                        onValueChange={(value) =>
                          updateRule(reminderType, (current) => ({
                            ...current,
                            fallbackRoles: updateRoleAt(current.fallbackRoles, 0, value)
                              .filter((role) => role !== current.primaryRole),
                            secondaryRoles: current.secondaryRoles.filter((role) => role !== value),
                          }))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {ROLE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Fallback role #2</Label>
                      <Select
                        value={fallback2}
                        onValueChange={(value) =>
                          updateRule(reminderType, (current) => ({
                            ...current,
                            fallbackRoles: updateRoleAt(current.fallbackRoles, 1, value)
                              .filter((role) => role !== current.primaryRole),
                            secondaryRoles: current.secondaryRoles.filter((role) => role !== value),
                          }))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {ROLE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Secondary recipient (optional)</Label>
                      <Select
                        value={secondary1}
                        onValueChange={(value) =>
                          updateRule(reminderType, (current) => ({
                            ...current,
                            secondaryRoles: updateRoleAt(current.secondaryRoles, 0, value)
                              .filter((role) => role !== current.primaryRole)
                              .filter((role) => !current.fallbackRoles.includes(role)),
                          }))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {ROLE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded border px-3 py-2 text-sm space-y-1">
                    <p className="font-medium">Resolved chain preview</p>
                    {preview.primarySteps.map((step, index) => (
                      <p key={`${reminderType}-primary-${index}`} className="text-muted-foreground">
                        {index + 1}. {roleLabel(step.role)}:{' '}
                        {step.recipient ? `${step.recipient.label} (${step.recipient.phone})` : 'No active recipient'}
                      </p>
                    ))}
                    {preview.secondarySteps.map((step, index) => (
                      <p key={`${reminderType}-secondary-${index}`} className="text-muted-foreground">
                        Secondary {index + 1}. {roleLabel(step.role)}:{' '}
                        {step.recipient ? `${step.recipient.label} (${step.recipient.phone})` : 'No active recipient'}
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="flex gap-2">
              <Button onClick={() => void save()} disabled={!canSave || isPending}>
                Save Routing Policy
              </Button>
              <Button variant="outline" onClick={() => void load()} disabled={isPending}>
                Refresh
              </Button>
            </div>

            <div className="rounded border p-3 space-y-2">
              <p className="font-medium">Audit History</p>
              {data.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reminder routing audit entries yet.</p>
              ) : (
                <div className="space-y-1">
                  {data.history.slice(0, 8).map((entry) => (
                    <p key={entry.id} className="text-sm text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString('en-CA')} · {entry.action}
                      {entry.actorName ? ` · ${entry.actorName}` : ''}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
