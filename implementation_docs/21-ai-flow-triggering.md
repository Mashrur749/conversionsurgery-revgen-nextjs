# Phase 14c: AI Signal Detection & Flow Triggering

## Current State (after Phase 14b)
- Flows can be configured per client
- Manual trigger works
- No AI detection of when to suggest flows

## Goal
AI detects conversation signals and suggests appropriate flows.

---

## Step 1: Create Signal Detection Service

**CREATE** `src/lib/services/signal-detection.ts`:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface DetectedSignals {
  readyToSchedule: boolean;
  wantsEstimate: boolean;
  jobComplete: boolean;
  satisfied: boolean;
  frustrated: boolean;
  priceObjection: boolean;
  urgentNeed: boolean;
  justBrowsing: boolean;
  referralMention: boolean;
  paymentMention: boolean;
  confidence: number;
  rawSignals: string[];
}

const SIGNAL_PROMPT = `Analyze this conversation and detect customer signals. Return JSON only.

Signals to detect:
- readyToSchedule: Customer wants to book/schedule (e.g., "when can you come", "I'm available Tuesday")
- wantsEstimate: Customer wants a quote/estimate (e.g., "how much would it cost", "can you send pricing")
- jobComplete: References completed work (e.g., "the job looks great", "you guys finished")
- satisfied: Expresses satisfaction (e.g., "thank you so much", "great work", "very happy")
- frustrated: Shows frustration (e.g., "this is taking too long", "I've been waiting")
- priceObjection: Concern about price (e.g., "that's more than expected", "too expensive")
- urgentNeed: Emergency/urgent situation (e.g., "leaking now", "need help ASAP", "emergency")
- justBrowsing: Not serious buyer (e.g., "just getting quotes", "maybe next year")
- referralMention: Mentions referring others (e.g., "I'll tell my neighbors", "my friend needs")
- paymentMention: Discusses payment (e.g., "how do I pay", "what do I owe", "send invoice")

Return format:
{
  "readyToSchedule": false,
  "wantsEstimate": false,
  "jobComplete": false,
  "satisfied": false,
  "frustrated": false,
  "priceObjection": false,
  "urgentNeed": false,
  "justBrowsing": false,
  "referralMention": false,
  "paymentMention": false,
  "confidence": 85,
  "rawSignals": ["specific phrases detected"]
}`;

export async function detectSignals(
  conversationHistory: { role: string; content: string }[]
): Promise<DetectedSignals> {
  // Only analyze last 10 messages for efficiency
  const recentMessages = conversationHistory.slice(-10);
  
  const conversationText = recentMessages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SIGNAL_PROMPT },
        { role: 'user', content: conversationText },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      readyToSchedule: result.readyToSchedule || false,
      wantsEstimate: result.wantsEstimate || false,
      jobComplete: result.jobComplete || false,
      satisfied: result.satisfied || false,
      frustrated: result.frustrated || false,
      priceObjection: result.priceObjection || false,
      urgentNeed: result.urgentNeed || false,
      justBrowsing: result.justBrowsing || false,
      referralMention: result.referralMention || false,
      paymentMention: result.paymentMention || false,
      confidence: result.confidence || 50,
      rawSignals: result.rawSignals || [],
    };
  } catch (error) {
    console.error('Signal detection error:', error);
    return {
      readyToSchedule: false,
      wantsEstimate: false,
      jobComplete: false,
      satisfied: false,
      frustrated: false,
      priceObjection: false,
      urgentNeed: false,
      justBrowsing: false,
      referralMention: false,
      paymentMention: false,
      confidence: 0,
      rawSignals: [],
    };
  }
}

// Map signals to flow triggers
export function mapSignalsToFlows(signals: DetectedSignals): string[] {
  const suggestedFlows: string[] = [];

  if (signals.readyToSchedule) {
    suggestedFlows.push('Schedule Appointment');
  }
  if (signals.wantsEstimate) {
    suggestedFlows.push('Estimate Follow-up');
  }
  if ((signals.jobComplete && signals.satisfied) || signals.satisfied) {
    suggestedFlows.push('Review Request');
  }
  if (signals.referralMention) {
    suggestedFlows.push('Referral Request');
  }
  if (signals.paymentMention) {
    suggestedFlows.push('Payment Reminder');
  }

  return suggestedFlows;
}
```

---

## Step 2: Create Flow Suggestion Service

**CREATE** `src/lib/services/flow-suggestions.ts`:

```typescript
import { db } from '@/lib/db';
import { flows, suggestedActions, clients, leads } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { detectSignals, mapSignalsToFlows, DetectedSignals } from './signal-detection';
import { sendSMS } from './twilio';

export async function checkAndSuggestFlows(
  leadId: string,
  clientId: string,
  conversationHistory: { role: string; content: string }[]
): Promise<void> {
  // Detect signals
  const signals = await detectSignals(conversationHistory);
  
  if (signals.confidence < 60) return; // Not confident enough

  // Map signals to flow names
  const suggestedFlowNames = mapSignalsToFlows(signals);
  
  if (suggestedFlowNames.length === 0) return;

  // Find matching flows for this client
  const clientFlows = await db
    .select()
    .from(flows)
    .where(and(
      eq(flows.clientId, clientId),
      eq(flows.trigger, 'ai_suggested'),
      eq(flows.isActive, true)
    ));

  for (const flowName of suggestedFlowNames) {
    const matchingFlow = clientFlows.find(f => 
      f.name.toLowerCase().includes(flowName.toLowerCase())
    );

    if (!matchingFlow) continue;

    // Check if we already suggested this flow recently
    const existingSuggestion = await db
      .select()
      .from(suggestedActions)
      .where(and(
        eq(suggestedActions.leadId, leadId),
        eq(suggestedActions.flowId, matchingFlow.id),
        eq(suggestedActions.status, 'pending')
      ))
      .limit(1);

    if (existingSuggestion.length > 0) continue;

    // Create suggestion
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const [suggestion] = await db
      .insert(suggestedActions)
      .values({
        leadId,
        clientId,
        flowId: matchingFlow.id,
        reason: `Detected: ${signals.rawSignals.join(', ')}`,
        detectedSignal: flowName,
        confidence: signals.confidence,
        expiresAt,
      })
      .returning();

    // If flow requires SMS approval, send it
    if (matchingFlow.approvalMode === 'ask_sms') {
      await sendApprovalSMS(suggestion.id, clientId, leadId, matchingFlow.name);
    }
  }
}

async function sendApprovalSMS(
  suggestionId: string,
  clientId: string,
  leadId: string,
  flowName: string
): Promise<void> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!client?.phone || !client.twilioNumber) return;

  const message = `🎯 ${lead?.name || lead?.phone} - AI suggests: "${flowName}"\n\nReply:\nYES ${suggestionId.slice(0, 8)} - to approve\nNO ${suggestionId.slice(0, 8)} - to skip`;

  await sendSMS(client.phone, client.twilioNumber, message);
}

export async function handleApprovalResponse(
  clientId: string,
  messageBody: string
): Promise<{ handled: boolean; action?: string }> {
  const upperBody = messageBody.toUpperCase().trim();
  
  // Check for YES/NO pattern
  const yesMatch = upperBody.match(/^YES\s+([A-F0-9]{8})/i);
  const noMatch = upperBody.match(/^NO\s+([A-F0-9]{8})/i);

  if (!yesMatch && !noMatch) {
    return { handled: false };
  }

  const shortId = (yesMatch || noMatch)![1].toLowerCase();
  const approved = !!yesMatch;

  // Find the suggestion
  const suggestions = await db
    .select()
    .from(suggestedActions)
    .where(and(
      eq(suggestedActions.clientId, clientId),
      eq(suggestedActions.status, 'pending')
    ));

  const suggestion = suggestions.find(s => s.id.startsWith(shortId));

  if (!suggestion) {
    return { handled: true, action: 'suggestion_not_found' };
  }

  if (approved) {
    // Update suggestion
    await db
      .update(suggestedActions)
      .set({
        status: 'approved',
        respondedAt: new Date(),
        respondedBy: 'sms',
      })
      .where(eq(suggestedActions.id, suggestion.id));

    // Start the flow
    const { startFlowExecution } = await import('./flows');
    await startFlowExecution(
      suggestion.flowId!,
      suggestion.leadId!,
      suggestion.clientId!,
      false
    );

    return { handled: true, action: 'flow_approved' };
  } else {
    // Reject
    await db
      .update(suggestedActions)
      .set({
        status: 'rejected',
        respondedAt: new Date(),
        respondedBy: 'sms',
      })
      .where(eq(suggestedActions.id, suggestion.id));

    return { handled: true, action: 'flow_rejected' };
  }
}
```

---

## Step 3: Integrate Signal Detection into Incoming SMS

**UPDATE** `src/lib/automations/incoming-sms.ts`:

Add after AI response, before returning:

```typescript
// After AI responds successfully, check for flow suggestions
import { checkAndSuggestFlows } from '@/lib/services/flow-suggestions';
import { handleApprovalResponse } from '@/lib/services/flow-suggestions';

// At the start of handleIncomingSMS, check for approval responses from client
const approvalCheck = await handleApprovalResponse(client.id, messageBody);
if (approvalCheck.handled) {
  return { processed: true, action: approvalCheck.action };
}

// ... existing AI response code ...

// After AI responds, check for suggestions (async, don't wait)
checkAndSuggestFlows(lead.id, client.id, conversationHistory).catch(console.error);
```

---

## Step 4: Create Suggested Actions API for CRM

**CREATE** `src/app/api/client/leads/[id]/suggestions/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { suggestedActions, flows, leads } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const clientId = cookieStore.get('clientSessionId')?.value;

  if (!clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const suggestions = await db
    .select({
      id: suggestedActions.id,
      flowName: flows.name,
      reason: suggestedActions.reason,
      confidence: suggestedActions.confidence,
      status: suggestedActions.status,
      createdAt: suggestedActions.createdAt,
    })
    .from(suggestedActions)
    .innerJoin(flows, eq(suggestedActions.flowId, flows.id))
    .where(and(
      eq(suggestedActions.leadId, params.id),
      eq(suggestedActions.clientId, clientId)
    ))
    .orderBy(desc(suggestedActions.createdAt))
    .limit(10);

  return NextResponse.json({ suggestions });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const clientId = cookieStore.get('clientSessionId')?.value;

  if (!clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { suggestionId, action } = await request.json();

  if (action === 'approve') {
    await db
      .update(suggestedActions)
      .set({
        status: 'approved',
        respondedAt: new Date(),
        respondedBy: 'crm',
      })
      .where(eq(suggestedActions.id, suggestionId));

    // Get suggestion to start flow
    const [suggestion] = await db
      .select()
      .from(suggestedActions)
      .where(eq(suggestedActions.id, suggestionId))
      .limit(1);

    if (suggestion?.flowId && suggestion.leadId) {
      const { startFlowExecution } = await import('@/lib/services/flows');
      await startFlowExecution(suggestion.flowId, suggestion.leadId, clientId, false);
    }

    return NextResponse.json({ success: true, action: 'approved' });
  } else if (action === 'reject') {
    await db
      .update(suggestedActions)
      .set({
        status: 'rejected',
        respondedAt: new Date(),
        respondedBy: 'crm',
      })
      .where(eq(suggestedActions.id, suggestionId));

    return NextResponse.json({ success: true, action: 'rejected' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
```

---

## Step 5: Update Conversation View with Suggestions

**UPDATE** `src/app/(client)/client/conversations/[id]/conversation-view.tsx`:

Add suggestions display in the conversation view:

```typescript
// Add to component
const [suggestions, setSuggestions] = useState<any[]>([]);

useEffect(() => {
  fetch(`/api/client/leads/${lead.id}/suggestions`)
    .then(res => res.json())
    .then(data => setSuggestions(data.suggestions?.filter((s: any) => s.status === 'pending') || []));
}, [lead.id]);

async function handleSuggestion(suggestionId: string, action: 'approve' | 'reject') {
  await fetch(`/api/client/leads/${lead.id}/suggestions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suggestionId, action }),
  });
  setSuggestions(suggestions.filter(s => s.id !== suggestionId));
}

// Add in the render, before the input area:
{suggestions.length > 0 && (
  <div className="border-t pt-4 space-y-2">
    {suggestions.map((suggestion) => (
      <Card key={suggestion.id} className="bg-blue-50 border-blue-200">
        <CardContent className="py-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-blue-900">💡 AI Suggests: {suggestion.flowName}</p>
              <p className="text-sm text-blue-700">{suggestion.reason}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleSuggestion(suggestion.id, 'approve')}>
                Send
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleSuggestion(suggestion.id, 'reject')}>
                Dismiss
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
)}
```

---

## Verify

1. `npm run dev`
2. Have a conversation where lead expresses satisfaction
3. AI should detect signal and create suggestion
4. Client receives SMS asking for approval (if ask_sms mode)
5. Reply YES/NO to approve/reject
6. Or view/approve in CRM conversation view

---

## Next
Proceed to **Phase 14d** for flow metrics.
