'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AI_ASSIST_CATEGORIES, AI_ASSIST_CATEGORY } from '@/lib/services/ai-send-policy';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { ReadinessResult } from '@/lib/services/readiness-check';

const SMART_ASSIST_CATEGORY_LABELS: Record<string, string> = {
  first_response: 'First response',
  follow_up: 'Follow-up',
  estimate_followup: 'Estimate follow-up',
  payment: 'Payment reminders',
  appointment: 'Appointment messages',
  review: 'Review requests',
  general: 'General outbound AI',
};

interface FeatureFlags {
  missedCallSmsEnabled: boolean | null;
  aiResponseEnabled: boolean | null;
  aiAgentEnabled: boolean | null;
  aiAgentMode: string | null;
  autoEscalationEnabled: boolean | null;
  smartAssistEnabled: boolean | null;
  smartAssistDelayMinutes: number | null;
  smartAssistManualCategories: string[] | null;
  voiceEnabled: boolean | null;
  flowsEnabled: boolean | null;
  leadScoringEnabled: boolean | null;
  reputationMonitoringEnabled: boolean | null;
  autoReviewResponseEnabled: boolean | null;
  calendarSyncEnabled: boolean | null;
  hotTransferEnabled: boolean | null;
  paymentLinksEnabled: boolean | null;
  photoRequestsEnabled: boolean | null;
  multiLanguageEnabled: boolean | null;
  preferredLanguage: string | null;
}

interface Props {
  clientId: string;
  flags: FeatureFlags;
}

export function FeatureTogglesCard({ clientId, flags }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [readinessData, setReadinessData] = useState<ReadinessResult | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState('');
  const [exclusionConfirmLoading, setExclusionConfirmLoading] = useState(false);
  const [formData, setFormData] = useState({
    missedCallSmsEnabled: flags.missedCallSmsEnabled ?? true,
    aiResponseEnabled: flags.aiResponseEnabled ?? true,
    aiAgentEnabled: flags.aiAgentEnabled ?? true,
    aiAgentMode: flags.aiAgentMode ?? 'assist',
    autoEscalationEnabled: flags.autoEscalationEnabled ?? true,
    smartAssistEnabled: flags.smartAssistEnabled ?? true,
    smartAssistDelayMinutes: flags.smartAssistDelayMinutes ?? 5,
    smartAssistManualCategories: flags.smartAssistManualCategories ?? [
      AI_ASSIST_CATEGORY.ESTIMATE_FOLLOWUP,
      AI_ASSIST_CATEGORY.PAYMENT,
    ],
    voiceEnabled: flags.voiceEnabled ?? false,
    flowsEnabled: flags.flowsEnabled ?? true,
    leadScoringEnabled: flags.leadScoringEnabled ?? true,
    reputationMonitoringEnabled: flags.reputationMonitoringEnabled ?? false,
    autoReviewResponseEnabled: flags.autoReviewResponseEnabled ?? false,
    calendarSyncEnabled: flags.calendarSyncEnabled ?? false,
    hotTransferEnabled: flags.hotTransferEnabled ?? false,
    paymentLinksEnabled: flags.paymentLinksEnabled ?? false,
    photoRequestsEnabled: flags.photoRequestsEnabled ?? true,
    multiLanguageEnabled: flags.multiLanguageEnabled ?? false,
    preferredLanguage: flags.preferredLanguage ?? 'en',
  });

  async function fetchReadiness() {
    setReadinessLoading(true);
    setReadinessError('');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/readiness`);
      const data = (await res.json()) as ReadinessResult & { error?: string };
      if (!res.ok) {
        setReadinessError(data.error || 'Failed to load readiness data');
        return;
      }
      setReadinessData(data);
    } catch {
      setReadinessError('Failed to load readiness data');
    } finally {
      setReadinessLoading(false);
    }
  }

  function toggleFlag(key: keyof typeof formData) {
    setFormData((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleManualCategory(category: string) {
    setFormData((prev) => {
      const current = prev.smartAssistManualCategories;
      const exists = current.includes(category);
      return {
        ...prev,
        smartAssistManualCategories: exists
          ? current.filter((item) => item !== category)
          : [...current, category],
      };
    });
  }

  async function handleSave() {
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error || 'Failed to update features');
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Configuration</CardTitle>
        <CardDescription>
          Enable or disable features for this client
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 text-sm text-destructive bg-[#FDEAE4] rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 text-sm text-[#3D7A50] bg-[#E8F5E9] rounded-lg">
            Features updated successfully
          </div>
        )}

        {/* Core SMS */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Core SMS
          </h4>
          <FeatureToggle
            id="missedCallSmsEnabled"
            label="Missed Call SMS"
            description="Send automatic SMS when calls are missed"
            checked={formData.missedCallSmsEnabled}
            onToggle={() => toggleFlag('missedCallSmsEnabled')}
          />
          <FeatureToggle
            id="aiResponseEnabled"
            label="AI Responses"
            description="Use AI to generate contextual replies"
            checked={formData.aiResponseEnabled}
            onToggle={() => toggleFlag('aiResponseEnabled')}
          />
        </div>

        {/* AI Agent */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            AI Agent
          </h4>
          <FeatureToggle
            id="aiAgentEnabled"
            label="AI Conversation Agent"
            description="Enable intelligent multi-turn conversations"
            checked={formData.aiAgentEnabled}
            onToggle={() => toggleFlag('aiAgentEnabled')}
          />
          <div className="flex items-center justify-between">
            <div>
              <Label>Agent Mode</Label>
              <p className="text-sm text-muted-foreground">
                How autonomous should the AI be?
              </p>
            </div>
            <Select
              value={formData.aiAgentMode}
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, aiAgentMode: value }));
                if (value === 'autonomous') {
                  void fetchReadiness();
                } else {
                  setReadinessData(null);
                  setReadinessError('');
                }
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="assist">Assist (suggest)</SelectItem>
                <SelectItem value="autonomous">Autonomous</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Autonomous Readiness Checklist */}
          {formData.aiAgentMode === 'autonomous' && (
            <div className="space-y-3 rounded-lg border p-3 bg-[#F8F9FA]">
              {readinessLoading && (
                <div className="space-y-2">
                  <div className="h-4 bg-[#E3E9E1] rounded animate-pulse w-1/2" />
                  <div className="h-4 bg-[#E3E9E1] rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-[#E3E9E1] rounded animate-pulse w-2/3" />
                </div>
              )}
              {readinessError && !readinessLoading && (
                <p className="text-sm text-[#C15B2E]">{readinessError}</p>
              )}
              {readinessData && !readinessLoading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {readinessData.passedCount} of {readinessData.totalCount} requirements met
                    </span>
                    {!readinessData.allCriticalPassed && (
                      <span className="text-sm text-[#C15B2E] font-medium">
                        Save blocked
                      </span>
                    )}
                  </div>
                  {!readinessData.allCriticalPassed && (
                    <p className="text-sm text-[#C15B2E]">
                      Resolve the following before enabling autonomous mode:
                    </p>
                  )}
                  <ul className="space-y-2">
                    {readinessData.items.map((item) => (
                      <li key={item.key} className="space-y-1">
                        <div className="flex items-start gap-2">
                          {item.passed ? (
                            <CheckCircle2
                              className="h-4 w-4 mt-0.5 shrink-0"
                              style={{ color: '#3D7A50' }}
                            />
                          ) : item.severity === 'critical' ? (
                            <XCircle
                              className="h-4 w-4 mt-0.5 shrink-0"
                              style={{ color: '#C15B2E' }}
                            />
                          ) : (
                            <AlertTriangle
                              className="h-4 w-4 mt-0.5 shrink-0"
                              style={{ color: '#6B7E54' }}
                            />
                          )}
                          <div>
                            <span
                              className="text-sm font-medium"
                              style={{
                                color: item.passed
                                  ? '#3D7A50'
                                  : item.severity === 'critical'
                                    ? '#C15B2E'
                                    : '#6B7E54',
                              }}
                            >
                              {item.label}
                            </span>
                            {!item.passed && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                        {!item.passed && item.key === 'exclusion_list' && (
                          <div className="ml-6 mt-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={exclusionConfirmLoading}
                              onClick={async () => {
                                setExclusionConfirmLoading(true);
                                try {
                                  const res = await fetch(
                                    `/api/admin/clients/${clientId}`,
                                    {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ exclusionListReviewed: true }),
                                    }
                                  );
                                  if (res.ok) {
                                    await fetchReadiness();
                                  }
                                } finally {
                                  setExclusionConfirmLoading(false);
                                }
                              }}
                            >
                              {exclusionConfirmLoading
                                ? 'Saving...'
                                : 'I have reviewed the exclusion list with the contractor'}
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <FeatureToggle
            id="autoEscalationEnabled"
            label="Auto Escalation"
            description="Automatically escalate to humans when needed"
            checked={formData.autoEscalationEnabled}
            onToggle={() => toggleFlag('autoEscalationEnabled')}
          />
          <FeatureToggle
            id="smartAssistEnabled"
            label="Smart Assist Auto-Send"
            description="Queue AI drafts for approval and auto-send after delay"
            checked={formData.smartAssistEnabled}
            onToggle={() => toggleFlag('smartAssistEnabled')}
          />
          {formData.smartAssistEnabled && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-send delay</Label>
                  <p className="text-sm text-muted-foreground">
                    Time before untouched AI drafts send automatically
                  </p>
                </div>
                <Select
                  value={String(formData.smartAssistDelayMinutes)}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      smartAssistDelayMinutes: Number(value),
                    }))
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 minute</SelectItem>
                    <SelectItem value="3">3 minutes</SelectItem>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="10">10 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Manual-only categories</Label>
                <p className="text-sm text-muted-foreground">
                  These categories require explicit approval and never auto-send.
                </p>
                <div className="space-y-2">
                  {AI_ASSIST_CATEGORIES.map((category) => (
                    <FeatureToggle
                      key={category}
                      id={`manual-${category}`}
                      label={SMART_ASSIST_CATEGORY_LABELS[category] || category}
                      description="Require manual approval"
                      checked={formData.smartAssistManualCategories.includes(category)}
                      onToggle={() => toggleManualCategory(category)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Voice */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Voice AI
          </h4>
          <FeatureToggle
            id="voiceEnabled"
            label="Voice AI"
            description="AI answers incoming calls"
            checked={formData.voiceEnabled}
            onToggle={() => toggleFlag('voiceEnabled')}
          />
        </div>

        {/* Automation */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Automation
          </h4>
          <FeatureToggle
            id="flowsEnabled"
            label="Automated Flows"
            description="Enable sequence-based automations"
            checked={formData.flowsEnabled}
            onToggle={() => toggleFlag('flowsEnabled')}
          />
          <FeatureToggle
            id="leadScoringEnabled"
            label="Lead Scoring"
            description="Automatically score lead quality"
            checked={formData.leadScoringEnabled}
            onToggle={() => toggleFlag('leadScoringEnabled')}
          />
        </div>

        {/* Integrations */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Integrations
          </h4>
          <FeatureToggle
            id="calendarSyncEnabled"
            label="Calendar Sync"
            description="Sync with Google/Outlook calendar"
            checked={formData.calendarSyncEnabled}
            onToggle={() => toggleFlag('calendarSyncEnabled')}
          />
          <FeatureToggle
            id="hotTransferEnabled"
            label="Hot Transfer"
            description="Enable live call transfers"
            checked={formData.hotTransferEnabled}
            onToggle={() => toggleFlag('hotTransferEnabled')}
          />
          <FeatureToggle
            id="paymentLinksEnabled"
            label="Payment Links"
            description="Send payment collection links"
            checked={formData.paymentLinksEnabled}
            onToggle={() => toggleFlag('paymentLinksEnabled')}
          />
        </div>

        {/* Reputation */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Reputation
          </h4>
          <FeatureToggle
            id="reputationMonitoringEnabled"
            label="Review Monitoring"
            description="Monitor Google reviews"
            checked={formData.reputationMonitoringEnabled}
            onToggle={() => toggleFlag('reputationMonitoringEnabled')}
          />
          <FeatureToggle
            id="autoReviewResponseEnabled"
            label="Auto Review Response"
            description="AI-generated review responses"
            checked={formData.autoReviewResponseEnabled}
            onToggle={() => toggleFlag('autoReviewResponseEnabled')}
          />
        </div>

        {/* Communication */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Communication
          </h4>
          <FeatureToggle
            id="photoRequestsEnabled"
            label="Photo Requests"
            description="Request photos from leads"
            checked={formData.photoRequestsEnabled}
            onToggle={() => toggleFlag('photoRequestsEnabled')}
          />
          <FeatureToggle
            id="multiLanguageEnabled"
            label="Multi-Language"
            description="Support multiple languages"
            checked={formData.multiLanguageEnabled}
            onToggle={() => toggleFlag('multiLanguageEnabled')}
          />
        </div>

        {formData.aiAgentMode === 'autonomous' &&
          readinessData &&
          !readinessData.allCriticalPassed && (
            <p className="text-sm text-[#C15B2E] text-center">
              Cannot save &mdash; resolve critical requirements above
            </p>
          )}
        <Button
          onClick={handleSave}
          disabled={
            loading ||
            (formData.aiAgentMode === 'autonomous' &&
              readinessData !== null &&
              !readinessData.allCriticalPassed)
          }
          className="w-full"
        >
          {loading ? 'Saving...' : 'Save Feature Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}

function FeatureToggle({
  id,
  label,
  description,
  checked,
  onToggle,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}
