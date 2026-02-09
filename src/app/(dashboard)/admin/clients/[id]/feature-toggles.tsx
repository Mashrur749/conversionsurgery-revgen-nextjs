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

interface FeatureFlags {
  missedCallSmsEnabled: boolean | null;
  aiResponseEnabled: boolean | null;
  aiAgentEnabled: boolean | null;
  aiAgentMode: string | null;
  autoEscalationEnabled: boolean | null;
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
  const [formData, setFormData] = useState({
    missedCallSmsEnabled: flags.missedCallSmsEnabled ?? true,
    aiResponseEnabled: flags.aiResponseEnabled ?? true,
    aiAgentEnabled: flags.aiAgentEnabled ?? true,
    aiAgentMode: flags.aiAgentMode ?? 'assist',
    autoEscalationEnabled: flags.autoEscalationEnabled ?? true,
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

  function toggleFlag(key: keyof typeof formData) {
    setFormData((prev) => ({ ...prev, [key]: !prev[key] }));
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
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 text-sm text-green-600 bg-green-50 rounded-lg">
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
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, aiAgentMode: value }))
              }
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
          <FeatureToggle
            id="autoEscalationEnabled"
            label="Auto Escalation"
            description="Automatically escalate to humans when needed"
            checked={formData.autoEscalationEnabled}
            onToggle={() => toggleFlag('autoEscalationEnabled')}
          />
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

        <Button onClick={handleSave} disabled={loading} className="w-full">
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
