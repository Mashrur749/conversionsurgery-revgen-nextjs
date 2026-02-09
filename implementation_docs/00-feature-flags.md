# Feature Flags & Configuration Reconciliation

## Purpose

This document defines **all configurable feature flags** for the ConversionSurgery platform. Every major feature MUST be toggleable per-client. Nothing is forced.

---

## Client Feature Flags Schema

**ADD to `src/lib/db/schema.ts`** (clients table):

```typescript
export const clients = pgTable('clients', {
  // ... existing fields ...
  
  // ============================================
  // FEATURE FLAGS (all default to sensible values)
  // ============================================
  
  // CORE SMS AUTOMATION
  missedCallSmsEnabled: boolean('missed_call_sms_enabled').default(true),
  aiResponseEnabled: boolean('ai_response_enabled').default(true),
  
  // CONVERSATION AGENT (Phase 36-37)
  aiAgentEnabled: boolean('ai_agent_enabled').default(true),
  aiAgentMode: varchar('ai_agent_mode', { length: 20 }).default('assist'), // 'off', 'assist', 'autonomous'
  autoEscalationEnabled: boolean('auto_escalation_enabled').default(true),
  
  // VOICE AI (Phase 22) - already exists
  // voiceEnabled: boolean('voice_enabled').default(false),
  // voiceMode: varchar('voice_mode', { length: 20 }).default('after_hours'),
  
  // FLOWS (Phase 14)
  flowsEnabled: boolean('flows_enabled').default(true),
  
  // LEAD SCORING (Phase 17b)
  leadScoringEnabled: boolean('lead_scoring_enabled').default(true),
  
  // REPUTATION (Phase 19)
  reputationMonitoringEnabled: boolean('reputation_monitoring_enabled').default(false),
  autoReviewResponseEnabled: boolean('auto_review_response_enabled').default(false),
  
  // CALENDAR (Phase 21)
  calendarSyncEnabled: boolean('calendar_sync_enabled').default(false),
  
  // HOT TRANSFER (Phase 09)
  hotTransferEnabled: boolean('hot_transfer_enabled').default(false),
  
  // PAYMENTS (Phase 18b)
  paymentLinksEnabled: boolean('payment_links_enabled').default(false),
  
  // PHOTOS (Phase 18a)
  photoRequestsEnabled: boolean('photo_requests_enabled').default(true),
  
  // MULTI-LANGUAGE (Phase 20)
  multiLanguageEnabled: boolean('multi_language_enabled').default(false),
  preferredLanguage: varchar('preferred_language', { length: 10 }).default('en'),
  
  // WEEKLY SUMMARY (Phase 12c) - already exists
  // weeklySummaryEnabled: boolean('weekly_summary_enabled').default(true),
  
  // NOTIFICATIONS (Phase 16a) - already exists
  // notificationEmail: boolean('notification_email').default(true),
  // notificationSms: boolean('notification_sms').default(true),
});
```

---

## Feature Flag Defaults Summary

| Feature | Flag | Default | Rationale |
|---------|------|---------|-----------|
| **Missed Call SMS** | `missedCallSmsEnabled` | `true` | Core value prop |
| **AI Response** | `aiResponseEnabled` | `true` | Core value prop |
| **AI Agent** | `aiAgentEnabled` | `true` | Core value prop |
| **AI Agent Mode** | `aiAgentMode` | `assist` | Safe default with human oversight |
| **Auto Escalation** | `autoEscalationEnabled` | `true` | Safety feature |
| **Voice AI** | `voiceEnabled` | `false` | Requires explicit opt-in |
| **Flows** | `flowsEnabled` | `true` | Core value prop |
| **Lead Scoring** | `leadScoringEnabled` | `true` | Passive, no downside |
| **Reputation Monitoring** | `reputationMonitoringEnabled` | `false` | Requires Google Business setup |
| **Auto Review Response** | `autoReviewResponseEnabled` | `false` | Sensitive - needs approval |
| **Calendar Sync** | `calendarSyncEnabled` | `false` | Requires OAuth setup |
| **Hot Transfer** | `hotTransferEnabled` | `false` | Requires team setup |
| **Payment Links** | `paymentLinksEnabled` | `false` | Requires Stripe setup |
| **Photo Requests** | `photoRequestsEnabled` | `true` | Low risk, high value |
| **Multi-Language** | `multiLanguageEnabled` | `false` | English default |

---

## Specs Requiring Updates

Each spec below needs to check the relevant feature flag before executing.

### Phase 03: Core Automations

**File:** `/src/app/api/webhooks/twilio/sms/route.ts`

```typescript
// BEFORE processing missed call
if (!client.missedCallSmsEnabled) {
  return NextResponse.json({ status: 'skipped', reason: 'missed_call_sms_disabled' });
}

// BEFORE generating AI response
if (!client.aiResponseEnabled) {
  // Skip AI, just log the message
  return NextResponse.json({ status: 'received', aiResponse: false });
}
```

---

### Phase 09a/09b: Hot Transfer

**File:** `/src/lib/hot-transfer/service.ts`

```typescript
export async function initiateHotTransfer(leadId: string, clientId: string) {
  const client = await getClient(clientId);
  
  if (!client.hotTransferEnabled) {
    throw new Error('Hot transfer is not enabled for this client');
  }
  
  // ... existing logic
}
```

---

### Phase 14c: AI Flow Triggering

**File:** `/src/lib/flows/ai-trigger-service.ts`

```typescript
export async function evaluateFlowTriggers(leadId: string, clientId: string) {
  const client = await getClient(clientId);
  
  if (!client.flowsEnabled) {
    return { triggered: false, reason: 'flows_disabled' };
  }
  
  // ... existing logic
}
```

---

### Phase 17b: Lead Scoring

**File:** `/src/lib/leads/scoring-service.ts`

```typescript
export async function calculateLeadScore(leadId: string) {
  const lead = await getLead(leadId);
  const client = await getClient(lead.clientId);
  
  if (!client.leadScoringEnabled) {
    return null; // Don't calculate score
  }
  
  // ... existing logic
}
```

---

### Phase 18a: Photo Handling

**File:** `/src/lib/photos/photo-service.ts`

```typescript
export async function requestPhotos(leadId: string) {
  const lead = await getLead(leadId);
  const client = await getClient(lead.clientId);
  
  if (!client.photoRequestsEnabled) {
    throw new Error('Photo requests are not enabled for this client');
  }
  
  // ... existing logic
}
```

---

### Phase 18b: Payment Links

**File:** `/src/lib/payments/payment-link-service.ts`

```typescript
export async function createPaymentLink(invoiceId: string) {
  const invoice = await getInvoice(invoiceId);
  const client = await getClient(invoice.clientId);
  
  if (!client.paymentLinksEnabled) {
    throw new Error('Payment links are not enabled for this client');
  }
  
  // ... existing logic
}
```

---

### Phase 19a: Reputation Monitoring

**File:** `/src/lib/reputation/monitoring-service.ts`

```typescript
export async function checkReviews(clientId: string) {
  const client = await getClient(clientId);
  
  if (!client.reputationMonitoringEnabled) {
    return { checked: false, reason: 'monitoring_disabled' };
  }
  
  // ... existing logic
}
```

---

### Phase 19b: Review Response AI

**File:** `/src/lib/reputation/response-service.ts`

```typescript
export async function generateReviewResponse(reviewId: string) {
  const review = await getReview(reviewId);
  const client = await getClient(review.clientId);
  
  if (!client.autoReviewResponseEnabled) {
    return { generated: false, reason: 'auto_response_disabled' };
  }
  
  // ... existing logic
}
```

---

### Phase 20: Multi-Language

**File:** `/src/lib/i18n/language-service.ts`

```typescript
export function getClientLanguage(client: Client): string {
  if (!client.multiLanguageEnabled) {
    return 'en'; // Default to English
  }
  
  return client.preferredLanguage || 'en';
}
```

---

### Phase 21: Calendar Sync

**File:** `/src/lib/calendar/sync-service.ts`

```typescript
export async function syncCalendar(clientId: string) {
  const client = await getClient(clientId);
  
  if (!client.calendarSyncEnabled) {
    return { synced: false, reason: 'calendar_sync_disabled' };
  }
  
  // ... existing logic
}
```

---

### Phase 22: Voice AI

**Already has `voiceEnabled` check** ✅

```typescript
if (!client.voiceEnabled) {
  // Standard behavior - ring through or voicemail
}
```

---

### Phase 36-37: Conversation Agent

**File:** `/src/lib/conversation-agent/agent-service.ts`

```typescript
export async function processWithAgent(messageId: string) {
  const message = await getMessage(messageId);
  const client = await getClient(message.clientId);
  
  // Check if AI agent is enabled
  if (!client.aiAgentEnabled || client.aiAgentMode === 'off') {
    return { processed: false, reason: 'ai_agent_disabled' };
  }
  
  // Check mode for autonomous vs assist
  const isAutonomous = client.aiAgentMode === 'autonomous';
  
  // ... existing logic with mode-aware behavior
}
```

---

## Admin UI: Feature Toggles Panel

**ADD to client edit page** (`/src/app/(admin)/admin/clients/[id]/edit/page.tsx`):

```typescript
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function FeatureTogglesCard({ client }: { client: Client }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Configuration</CardTitle>
        <CardDescription>
          Enable or disable features for this client
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Core SMS */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Core SMS
          </h4>
          <FeatureToggle
            label="Missed Call SMS"
            description="Send automatic SMS when calls are missed"
            name="missedCallSmsEnabled"
            defaultChecked={client.missedCallSmsEnabled}
          />
          <FeatureToggle
            label="AI Responses"
            description="Use AI to generate contextual replies"
            name="aiResponseEnabled"
            defaultChecked={client.aiResponseEnabled}
          />
        </div>

        {/* AI Agent */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            AI Agent
          </h4>
          <FeatureToggle
            label="AI Conversation Agent"
            description="Enable intelligent multi-turn conversations"
            name="aiAgentEnabled"
            defaultChecked={client.aiAgentEnabled}
          />
          <div className="flex items-center justify-between">
            <div>
              <Label>Agent Mode</Label>
              <p className="text-sm text-muted-foreground">
                How autonomous should the AI be?
              </p>
            </div>
            <Select name="aiAgentMode" defaultValue={client.aiAgentMode}>
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
            label="Auto Escalation"
            description="Automatically escalate to humans when needed"
            name="autoEscalationEnabled"
            defaultChecked={client.autoEscalationEnabled}
          />
        </div>

        {/* Voice */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Voice AI
          </h4>
          <FeatureToggle
            label="Voice AI"
            description="AI answers incoming calls"
            name="voiceEnabled"
            defaultChecked={client.voiceEnabled}
          />
        </div>

        {/* Automation */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Automation
          </h4>
          <FeatureToggle
            label="Automated Flows"
            description="Enable sequence-based automations"
            name="flowsEnabled"
            defaultChecked={client.flowsEnabled}
          />
          <FeatureToggle
            label="Lead Scoring"
            description="Automatically score lead quality"
            name="leadScoringEnabled"
            defaultChecked={client.leadScoringEnabled}
          />
        </div>

        {/* Integrations */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Integrations
          </h4>
          <FeatureToggle
            label="Calendar Sync"
            description="Sync with Google/Outlook calendar"
            name="calendarSyncEnabled"
            defaultChecked={client.calendarSyncEnabled}
          />
          <FeatureToggle
            label="Hot Transfer"
            description="Enable live call transfers"
            name="hotTransferEnabled"
            defaultChecked={client.hotTransferEnabled}
          />
          <FeatureToggle
            label="Payment Links"
            description="Send payment collection links"
            name="paymentLinksEnabled"
            defaultChecked={client.paymentLinksEnabled}
          />
        </div>

        {/* Reputation */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Reputation
          </h4>
          <FeatureToggle
            label="Review Monitoring"
            description="Monitor Google reviews"
            name="reputationMonitoringEnabled"
            defaultChecked={client.reputationMonitoringEnabled}
          />
          <FeatureToggle
            label="Auto Review Response"
            description="AI-generated review responses"
            name="autoReviewResponseEnabled"
            defaultChecked={client.autoReviewResponseEnabled}
          />
        </div>

        {/* Communication */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Communication
          </h4>
          <FeatureToggle
            label="Photo Requests"
            description="Request photos from leads"
            name="photoRequestsEnabled"
            defaultChecked={client.photoRequestsEnabled}
          />
          <FeatureToggle
            label="Multi-Language"
            description="Support multiple languages"
            name="multiLanguageEnabled"
            defaultChecked={client.multiLanguageEnabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureToggle({ 
  label, 
  description, 
  name, 
  defaultChecked 
}: { 
  label: string; 
  description: string; 
  name: string; 
  defaultChecked: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Label htmlFor={name}>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch 
        id={name} 
        name={name} 
        defaultChecked={defaultChecked} 
      />
    </div>
  );
}
```

---

## Client Dashboard: Feature Status

**ADD to client settings page** to show which features are enabled:

```typescript
function FeatureStatusList({ client }: { client: Client }) {
  const features = [
    { name: 'Missed Call SMS', enabled: client.missedCallSmsEnabled, icon: Phone },
    { name: 'AI Responses', enabled: client.aiResponseEnabled, icon: Bot },
    { name: 'AI Agent', enabled: client.aiAgentEnabled, icon: Brain },
    { name: 'Voice AI', enabled: client.voiceEnabled, icon: Mic },
    { name: 'Automated Flows', enabled: client.flowsEnabled, icon: Workflow },
    { name: 'Lead Scoring', enabled: client.leadScoringEnabled, icon: Star },
    { name: 'Calendar Sync', enabled: client.calendarSyncEnabled, icon: Calendar },
    { name: 'Hot Transfer', enabled: client.hotTransferEnabled, icon: PhoneForwarded },
    { name: 'Payment Links', enabled: client.paymentLinksEnabled, icon: CreditCard },
    { name: 'Review Monitoring', enabled: client.reputationMonitoringEnabled, icon: MessageSquare },
    { name: 'Photo Requests', enabled: client.photoRequestsEnabled, icon: Camera },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {features.map((feature) => (
        <div 
          key={feature.name}
          className={cn(
            "p-3 rounded-lg border flex items-center gap-3",
            feature.enabled 
              ? "bg-green-50 border-green-200" 
              : "bg-gray-50 border-gray-200"
          )}
        >
          <feature.icon className={cn(
            "h-5 w-5",
            feature.enabled ? "text-green-600" : "text-gray-400"
          )} />
          <div>
            <p className="text-sm font-medium">{feature.name}</p>
            <p className="text-xs text-muted-foreground">
              {feature.enabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Migration

**CREATE** `drizzle/migrations/XXXX_add_feature_flags.sql`:

```sql
-- Add feature flags to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS missed_call_sms_enabled BOOLEAN DEFAULT true;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_response_enabled BOOLEAN DEFAULT true;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_agent_enabled BOOLEAN DEFAULT true;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_agent_mode VARCHAR(20) DEFAULT 'assist';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS auto_escalation_enabled BOOLEAN DEFAULT true;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS flows_enabled BOOLEAN DEFAULT true;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lead_scoring_enabled BOOLEAN DEFAULT true;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS reputation_monitoring_enabled BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS auto_review_response_enabled BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS calendar_sync_enabled BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hot_transfer_enabled BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_links_enabled BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_requests_enabled BOOLEAN DEFAULT true;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS multi_language_enabled BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en';

-- Note: voice_enabled and voice_mode already exist from Phase 22
-- Note: weekly_summary_enabled already exists from Phase 12c
-- Note: notification_email and notification_sms already exist from Phase 01
```

---

## Type Definition Update

**UPDATE** `src/types/client.ts`:

```typescript
export interface ClientFeatureFlags {
  // Core SMS
  missedCallSmsEnabled: boolean;
  aiResponseEnabled: boolean;
  
  // AI Agent
  aiAgentEnabled: boolean;
  aiAgentMode: 'off' | 'assist' | 'autonomous';
  autoEscalationEnabled: boolean;
  
  // Voice
  voiceEnabled: boolean;
  voiceMode: 'always' | 'after_hours' | 'overflow';
  
  // Automation
  flowsEnabled: boolean;
  leadScoringEnabled: boolean;
  
  // Integrations
  calendarSyncEnabled: boolean;
  hotTransferEnabled: boolean;
  paymentLinksEnabled: boolean;
  
  // Reputation
  reputationMonitoringEnabled: boolean;
  autoReviewResponseEnabled: boolean;
  
  // Communication
  photoRequestsEnabled: boolean;
  multiLanguageEnabled: boolean;
  preferredLanguage: string;
  
  // Notifications (existing)
  notificationEmail: boolean;
  notificationSms: boolean;
  weeklySummaryEnabled: boolean;
}
```

---

## Helper Function

**CREATE** `/src/lib/features/check-feature.ts`:

```typescript
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type FeatureFlag = 
  | 'missedCallSms'
  | 'aiResponse'
  | 'aiAgent'
  | 'autoEscalation'
  | 'voice'
  | 'flows'
  | 'leadScoring'
  | 'reputationMonitoring'
  | 'autoReviewResponse'
  | 'calendarSync'
  | 'hotTransfer'
  | 'paymentLinks'
  | 'photoRequests'
  | 'multiLanguage';

const featureToColumn: Record<FeatureFlag, keyof typeof clients.$inferSelect> = {
  missedCallSms: 'missedCallSmsEnabled',
  aiResponse: 'aiResponseEnabled',
  aiAgent: 'aiAgentEnabled',
  autoEscalation: 'autoEscalationEnabled',
  voice: 'voiceEnabled',
  flows: 'flowsEnabled',
  leadScoring: 'leadScoringEnabled',
  reputationMonitoring: 'reputationMonitoringEnabled',
  autoReviewResponse: 'autoReviewResponseEnabled',
  calendarSync: 'calendarSyncEnabled',
  hotTransfer: 'hotTransferEnabled',
  paymentLinks: 'paymentLinksEnabled',
  photoRequests: 'photoRequestsEnabled',
  multiLanguage: 'multiLanguageEnabled',
};

/**
 * Check if a feature is enabled for a client
 */
export async function isFeatureEnabled(
  clientId: string, 
  feature: FeatureFlag
): Promise<boolean> {
  const [client] = await db
    .select({ enabled: clients[featureToColumn[feature]] })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  
  return client?.enabled ?? false;
}

/**
 * Check multiple features at once
 */
export async function getEnabledFeatures(
  clientId: string,
  features: FeatureFlag[]
): Promise<Record<FeatureFlag, boolean>> {
  const columns = features.reduce((acc, feature) => {
    acc[feature] = clients[featureToColumn[feature]];
    return acc;
  }, {} as Record<string, any>);
  
  const [client] = await db
    .select(columns)
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  
  return features.reduce((acc, feature) => {
    acc[feature] = client?.[feature] ?? false;
    return acc;
  }, {} as Record<FeatureFlag, boolean>);
}

/**
 * Require a feature to be enabled, throw if not
 */
export async function requireFeature(
  clientId: string,
  feature: FeatureFlag,
  errorMessage?: string
): Promise<void> {
  const enabled = await isFeatureEnabled(clientId, feature);
  
  if (!enabled) {
    throw new Error(
      errorMessage ?? `Feature '${feature}' is not enabled for this client`
    );
  }
}
```

---

## Usage Example

```typescript
import { isFeatureEnabled, requireFeature } from '@/lib/features/check-feature';

// Option 1: Check and handle
export async function handleMissedCall(clientId: string, phone: string) {
  if (!await isFeatureEnabled(clientId, 'missedCallSms')) {
    console.log('Missed call SMS disabled for client', clientId);
    return { sent: false, reason: 'feature_disabled' };
  }
  
  // ... send SMS
}

// Option 2: Require (throws if disabled)
export async function createPaymentLink(clientId: string, amount: number) {
  await requireFeature(clientId, 'paymentLinks', 'Payment links are not enabled');
  
  // ... create link (only runs if feature is enabled)
}
```

---

## Dependencies

This spec should be implemented **BEFORE** any other specs during implementation, as it modifies the foundational `clients` table schema that all other specs depend on.

**Implementation Order:**
1. Run migration to add columns
2. Update schema.ts with new fields
3. Create helper functions
4. Update individual specs to use feature checks

---

## Checklist for Spec Updates

When implementing each spec, ensure the feature flag check is added:

- [ ] Phase 03: Check `missedCallSmsEnabled` and `aiResponseEnabled`
- [ ] Phase 09: Check `hotTransferEnabled`
- [ ] Phase 14c: Check `flowsEnabled`
- [ ] Phase 17b: Check `leadScoringEnabled`
- [ ] Phase 18a: Check `photoRequestsEnabled`
- [ ] Phase 18b: Check `paymentLinksEnabled`
- [ ] Phase 19a: Check `reputationMonitoringEnabled`
- [ ] Phase 19b: Check `autoReviewResponseEnabled`
- [ ] Phase 20: Check `multiLanguageEnabled`
- [ ] Phase 21: Check `calendarSyncEnabled`
- [ ] Phase 22: Already has `voiceEnabled` ✅
- [ ] Phase 36-37: Check `aiAgentEnabled` and `aiAgentMode`
