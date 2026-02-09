import {
  Phone,
  Bot,
  Brain,
  Mic,
  Workflow,
  Star,
  Calendar,
  PhoneForwarded,
  CreditCard,
  MessageSquare,
  Camera,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface FeatureFlags {
  missedCallSmsEnabled: boolean | null;
  aiResponseEnabled: boolean | null;
  aiAgentEnabled: boolean | null;
  voiceEnabled: boolean | null;
  flowsEnabled: boolean | null;
  leadScoringEnabled: boolean | null;
  calendarSyncEnabled: boolean | null;
  hotTransferEnabled: boolean | null;
  paymentLinksEnabled: boolean | null;
  reputationMonitoringEnabled: boolean | null;
  autoReviewResponseEnabled: boolean | null;
  photoRequestsEnabled: boolean | null;
  multiLanguageEnabled: boolean | null;
  autoEscalationEnabled: boolean | null;
}

interface FeatureItem {
  name: string;
  enabled: boolean;
  icon: LucideIcon;
}

export function FeatureStatusList({ client }: { client: FeatureFlags }) {
  const features: FeatureItem[] = [
    { name: 'Missed Call SMS', enabled: client.missedCallSmsEnabled ?? true, icon: Phone },
    { name: 'AI Responses', enabled: client.aiResponseEnabled ?? true, icon: Bot },
    { name: 'AI Agent', enabled: client.aiAgentEnabled ?? true, icon: Brain },
    { name: 'Auto Escalation', enabled: client.autoEscalationEnabled ?? true, icon: ShieldCheck },
    { name: 'Voice AI', enabled: client.voiceEnabled ?? false, icon: Mic },
    { name: 'Automated Flows', enabled: client.flowsEnabled ?? true, icon: Workflow },
    { name: 'Lead Scoring', enabled: client.leadScoringEnabled ?? true, icon: Star },
    { name: 'Calendar Sync', enabled: client.calendarSyncEnabled ?? false, icon: Calendar },
    { name: 'Hot Transfer', enabled: client.hotTransferEnabled ?? false, icon: PhoneForwarded },
    { name: 'Payment Links', enabled: client.paymentLinksEnabled ?? false, icon: CreditCard },
    { name: 'Review Monitoring', enabled: client.reputationMonitoringEnabled ?? false, icon: MessageSquare },
    { name: 'Auto Review Response', enabled: client.autoReviewResponseEnabled ?? false, icon: MessageSquare },
    { name: 'Photo Requests', enabled: client.photoRequestsEnabled ?? true, icon: Camera },
    { name: 'Multi-Language', enabled: client.multiLanguageEnabled ?? false, icon: Globe },
  ];

  const enabledCount = features.filter((f) => f.enabled).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Feature Status
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {enabledCount} of {features.length} enabled
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {features.map((feature) => (
            <div
              key={feature.name}
              className={cn(
                'p-3 rounded-lg border flex items-center gap-3',
                feature.enabled
                  ? 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200'
              )}
            >
              <feature.icon
                className={cn(
                  'h-5 w-5 shrink-0',
                  feature.enabled ? 'text-green-600' : 'text-gray-400'
                )}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{feature.name}</p>
                <p className="text-xs text-muted-foreground">
                  {feature.enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
