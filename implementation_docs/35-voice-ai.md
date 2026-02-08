# Phase 22: Voice AI (Future)

## Prerequisites
- All previous phases complete
- Twilio Voice API access
- Production-ready system

## Goal
AI-powered voice answering for missed calls - qualify leads, answer FAQs, schedule callbacks, and hand off to humans when needed.

---

## Overview

This is a **future phase** for when the product matures. Voice AI adds significant complexity and cost but creates major differentiation.

### Use Cases
1. **After-hours answering** - AI picks up when business is closed
2. **Overflow handling** - AI answers when all lines busy
3. **Lead qualification** - Collect info before connecting to human
4. **FAQ answering** - Handle common questions without human

### Technology Options
1. **Twilio + OpenAI Realtime API** - Most flexible, newest
2. **Twilio + ElevenLabs** - Best voice quality
3. **Bland.ai** - Turnkey solution, less control
4. **Retell.ai** - Good balance of control and ease

---

## Step 1: Add Voice Configuration

**MODIFY** `src/lib/db/schema.ts`:

```typescript
// Add to clients table
  voiceEnabled: boolean('voice_enabled').default(false),
  voiceMode: varchar('voice_mode', { length: 20 }).default('after_hours'), // always, after_hours, overflow
  voiceGreeting: text('voice_greeting'),
  voiceVoiceId: varchar('voice_voice_id', { length: 100 }), // ElevenLabs voice ID
  voiceMaxDuration: integer('voice_max_duration').default(300), // seconds
  businessHoursStart: time('business_hours_start'),
  businessHoursEnd: time('business_hours_end'),
  businessDays: jsonb('business_days').$type<number[]>().default([1,2,3,4,5]), // 0=Sun, 6=Sat

// New table for voice calls
export const voiceCalls = pgTable('voice_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  
  // Twilio info
  twilioCallSid: varchar('twilio_call_sid', { length: 50 }),
  from: varchar('from', { length: 20 }).notNull(),
  to: varchar('to', { length: 20 }).notNull(),
  
  // Call details
  direction: varchar('direction', { length: 10 }).default('inbound'),
  status: varchar('status', { length: 20 }), // initiated, ringing, in-progress, completed, failed
  duration: integer('duration'), // seconds
  
  // AI interaction
  transcript: text('transcript'),
  aiSummary: text('ai_summary'),
  callerIntent: varchar('caller_intent', { length: 50 }), // quote, schedule, question, complaint, other
  callerSentiment: varchar('caller_sentiment', { length: 20 }), // positive, neutral, negative
  
  // Outcome
  outcome: varchar('outcome', { length: 30 }), // qualified, scheduled, transferred, voicemail, dropped
  callbackRequested: boolean('callback_requested').default(false),
  callbackTime: timestamp('callback_time'),
  transferredTo: varchar('transferred_to', { length: 20 }),
  
  // Recording
  recordingUrl: varchar('recording_url', { length: 500 }),
  recordingSid: varchar('recording_sid', { length: 50 }),
  
  // Timestamps
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

## Step 2: Create Voice Webhook Handler

**CREATE** `src/app/api/webhooks/twilio/voice/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { db } from '@/lib/db';
import { clients, leads, voiceCalls } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { isWithinBusinessHours } from '@/lib/utils/time';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const from = formData.get('From') as string;
  const to = formData.get('To') as string;
  const callSid = formData.get('CallSid') as string;

  // Find client by phone number
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.twilioPhoneNumber, to))
    .limit(1);

  if (!client) {
    const response = new VoiceResponse();
    response.say('Sorry, this number is not configured.');
    response.hangup();
    return new NextResponse(response.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // Check if voice AI is enabled
  if (!client.voiceEnabled) {
    // Standard behavior - ring through or voicemail
    const response = new VoiceResponse();
    response.dial({ timeout: 30 }, client.forwardingNumber || '');
    return new NextResponse(response.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // Check business hours
  const withinHours = isWithinBusinessHours(
    client.businessHoursStart,
    client.businessHoursEnd,
    client.businessDays
  );

  // Determine if AI should answer
  const shouldUseAI =
    client.voiceMode === 'always' ||
    (client.voiceMode === 'after_hours' && !withinHours);

  if (!shouldUseAI) {
    // During business hours - try to connect
    const response = new VoiceResponse();
    const dial = response.dial({
      timeout: 20,
      action: '/api/webhooks/twilio/voice/dial-complete',
    });
    dial.number(client.forwardingNumber || client.ownerPhone || '');
    return new NextResponse(response.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // Find or create lead
  let lead = await db
    .select()
    .from(leads)
    .where(eq(leads.phone, from))
    .limit(1)
    .then(r => r[0]);

  if (!lead) {
    [lead] = await db
      .insert(leads)
      .values({
        clientId: client.id,
        phone: from,
        source: 'voice',
      })
      .returning();
  }

  // Create voice call record
  await db.insert(voiceCalls).values({
    clientId: client.id,
    leadId: lead.id,
    twilioCallSid: callSid,
    from,
    to,
    direction: 'inbound',
    status: 'in-progress',
    startedAt: new Date(),
  });

  // Start AI conversation
  const response = new VoiceResponse();
  
  // Greeting
  const greeting = client.voiceGreeting || 
    `Hi! Thanks for calling ${client.businessName}. How can I help you today?`;
  
  response.say({ voice: 'Polly.Matthew' }, greeting);
  
  // Gather speech input
  response.gather({
    input: ['speech'],
    speechTimeout: 'auto',
    speechModel: 'phone_call',
    enhanced: true,
    action: '/api/webhooks/twilio/voice/gather',
    method: 'POST',
  });
  
  // Fallback if no input
  response.say("I didn't catch that. Let me connect you with someone.");
  response.redirect('/api/webhooks/twilio/voice/transfer');

  return new NextResponse(response.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
```

---

## Step 3: Create AI Conversation Handler

**CREATE** `src/app/api/webhooks/twilio/voice/gather/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { db } from '@/lib/db';
import { voiceCalls, clients, leads, knowledgeBase } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

const VoiceResponse = twilio.twiml.VoiceResponse;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const callSid = formData.get('CallSid') as string;
  const speechResult = formData.get('SpeechResult') as string;
  const confidence = parseFloat(formData.get('Confidence') as string || '0');

  // Get call record
  const [call] = await db
    .select()
    .from(voiceCalls)
    .where(eq(voiceCalls.twilioCallSid, callSid))
    .limit(1);

  if (!call) {
    const response = new VoiceResponse();
    response.say('Sorry, there was an error. Goodbye.');
    response.hangup();
    return new NextResponse(response.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // Get client and knowledge base
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, call.clientId!))
    .limit(1);

  const knowledge = await db
    .select()
    .from(knowledgeBase)
    .where(eq(knowledgeBase.clientId, call.clientId!));

  const knowledgeContext = knowledge
    .map(k => `${k.category}: ${k.content}`)
    .join('\n');

  // Update transcript
  const currentTranscript = call.transcript || '';
  const newTranscript = `${currentTranscript}\nCaller: ${speechResult}`;

  // Analyze intent and generate response
  const aiResponse = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a phone assistant for ${client?.businessName}, a contractor.

Your capabilities:
1. Answer questions about services and pricing
2. Collect lead information (name, project details)
3. Schedule callbacks
4. Transfer to a human if needed

Knowledge base:
${knowledgeContext}

Business hours: ${client?.businessHoursStart} - ${client?.businessHoursEnd}

Respond conversationally and briefly (under 50 words).
End with a question or next step.

If the caller wants to:
- Get a quote: Collect project details, then offer callback
- Schedule appointment: Collect preferred time, confirm callback
- Speak to someone: Transfer immediately
- Emergency: Transfer immediately

Return JSON:
{
  "response": "What you say to caller",
  "intent": "quote|schedule|question|complaint|transfer|other",
  "shouldTransfer": false,
  "callbackRequested": false,
  "collectedInfo": {}
}`,
      },
      {
        role: 'user',
        content: `Conversation so far:\n${newTranscript}\n\nRespond to the caller.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 200,
  });

  let result;
  try {
    const content = aiResponse.choices[0].message.content || '{}';
    result = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
  } catch {
    result = {
      response: "I'm sorry, I didn't quite understand. Could you repeat that?",
      intent: 'other',
      shouldTransfer: false,
    };
  }

  // Update call record
  await db
    .update(voiceCalls)
    .set({
      transcript: `${newTranscript}\nAI: ${result.response}`,
      callerIntent: result.intent,
      callbackRequested: result.callbackRequested,
    })
    .where(eq(voiceCalls.id, call.id));

  const response = new VoiceResponse();

  // Check if should transfer
  if (result.shouldTransfer) {
    response.say({ voice: 'Polly.Matthew' }, "Let me connect you with someone right now.");
    response.redirect('/api/webhooks/twilio/voice/transfer');
  } else {
    // Continue conversation
    response.say({ voice: 'Polly.Matthew' }, result.response);
    
    response.gather({
      input: ['speech'],
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: true,
      action: '/api/webhooks/twilio/voice/gather',
      method: 'POST',
    });
    
    // Timeout fallback
    response.say("Are you still there?");
    response.gather({
      input: ['speech'],
      speechTimeout: 3,
      action: '/api/webhooks/twilio/voice/gather',
    });
    
    response.say("I'll have someone call you back. Goodbye!");
    response.hangup();
  }

  return new NextResponse(response.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
```

---

## Step 4: Create Transfer Handler

**CREATE** `src/app/api/webhooks/twilio/voice/transfer/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { db } from '@/lib/db';
import { voiceCalls, clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const callSid = formData.get('CallSid') as string;

  // Get call and client
  const [call] = await db
    .select()
    .from(voiceCalls)
    .where(eq(voiceCalls.twilioCallSid, callSid))
    .limit(1);

  if (!call) {
    const response = new VoiceResponse();
    response.say('Unable to transfer. Please try again later.');
    response.hangup();
    return new NextResponse(response.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, call.clientId!))
    .limit(1);

  const transferTo = client?.forwardingNumber || client?.ownerPhone;

  if (!transferTo) {
    const response = new VoiceResponse();
    response.say("I'm sorry, no one is available right now. Please leave a message after the beep.");
    response.record({
      maxLength: 120,
      action: '/api/webhooks/twilio/voice/recording',
      transcribe: true,
      transcribeCallback: '/api/webhooks/twilio/voice/transcription',
    });
    return new NextResponse(response.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // Update call record
  await db
    .update(voiceCalls)
    .set({
      outcome: 'transferred',
      transferredTo: transferTo,
    })
    .where(eq(voiceCalls.id, call.id));

  const response = new VoiceResponse();
  response.say({ voice: 'Polly.Matthew' }, 'Connecting you now. Please hold.');
  
  const dial = response.dial({
    callerId: call.to,
    timeout: 30,
    action: '/api/webhooks/twilio/voice/dial-complete',
  });
  dial.number(transferTo);

  return new NextResponse(response.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
```

---

## Step 5: Create Call Summary Service

**CREATE** `src/lib/services/voice-summary.ts`:

```typescript
import { db } from '@/lib/db';
import { voiceCalls, leads, clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { sendSMS } from './twilio';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateCallSummary(callId: string): Promise<string> {
  const [call] = await db
    .select()
    .from(voiceCalls)
    .where(eq(voiceCalls.id, callId))
    .limit(1);

  if (!call?.transcript) return '';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Summarize this phone call transcript in 2-3 sentences. Include:
- What the caller wanted
- Key details mentioned
- Outcome or next steps`,
      },
      {
        role: 'user',
        content: call.transcript,
      },
    ],
    temperature: 0.5,
    max_tokens: 150,
  });

  const summary = response.choices[0].message.content || '';

  await db
    .update(voiceCalls)
    .set({ aiSummary: summary })
    .where(eq(voiceCalls.id, callId));

  return summary;
}

export async function notifyClientOfCall(callId: string): Promise<void> {
  const [call] = await db
    .select()
    .from(voiceCalls)
    .where(eq(voiceCalls.id, callId))
    .limit(1);

  if (!call) return;

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, call.clientId!))
    .limit(1);

  if (!client?.ownerPhone) return;

  const summary = call.aiSummary || await generateCallSummary(callId);

  const message = `📞 New AI call from ${call.from}
Duration: ${Math.round((call.duration || 0) / 60)}min
Intent: ${call.callerIntent || 'Unknown'}
${call.callbackRequested ? '⏰ Callback requested!' : ''}

${summary}`;

  await sendSMS({
    to: client.ownerPhone,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body: message,
  });
}
```

---

## Step 6: Voice Settings UI

**CREATE** `src/components/settings/voice-settings.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Phone, Clock, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface VoiceSettingsProps {
  clientId: string;
  settings: {
    voiceEnabled: boolean;
    voiceMode: string;
    voiceGreeting: string;
    businessHoursStart: string;
    businessHoursEnd: string;
  };
}

export function VoiceSettings({ clientId, settings }: VoiceSettingsProps) {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      toast.success('Voice settings saved!');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Voice AI Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Enable Voice AI</Label>
            <p className="text-sm text-muted-foreground">
              AI will answer calls based on mode
            </p>
          </div>
          <Switch
            checked={form.voiceEnabled}
            onCheckedChange={(v) => setForm({ ...form, voiceEnabled: v })}
          />
        </div>

        {form.voiceEnabled && (
          <>
            {/* Mode */}
            <div className="space-y-2">
              <Label>Answer Mode</Label>
              <Select
                value={form.voiceMode}
                onValueChange={(v) => setForm({ ...form, voiceMode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="after_hours">After Hours Only</SelectItem>
                  <SelectItem value="overflow">Overflow (No Answer)</SelectItem>
                  <SelectItem value="always">Always</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Business hours */}
            {form.voiceMode === 'after_hours' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Opens At
                  </Label>
                  <Input
                    type="time"
                    value={form.businessHoursStart}
                    onChange={(e) =>
                      setForm({ ...form, businessHoursStart: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Closes At</Label>
                  <Input
                    type="time"
                    value={form.businessHoursEnd}
                    onChange={(e) =>
                      setForm({ ...form, businessHoursEnd: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            {/* Greeting */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                Greeting Message
              </Label>
              <Textarea
                value={form.voiceGreeting}
                onChange={(e) =>
                  setForm({ ...form, voiceGreeting: e.target.value })
                }
                placeholder="Hi! Thanks for calling ABC Roofing. How can I help you today?"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This is what callers hear first
              </p>
            </div>
          </>
        )}

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? 'Saving...' : 'Save Voice Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

## Step 7: Voice Call History Component

**CREATE** `src/components/voice/call-history.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Clock, Play, FileText } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface VoiceCall {
  id: string;
  from: string;
  duration: number;
  callerIntent: string;
  outcome: string;
  aiSummary: string;
  recordingUrl: string;
  startedAt: string;
}

interface CallHistoryProps {
  clientId: string;
}

export function CallHistory({ clientId }: CallHistoryProps) {
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/voice-calls`)
      .then((r) => r.json())
      .then((data) => {
        setCalls(data);
        setLoading(false);
      });
  }, [clientId]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const intentColors: Record<string, string> = {
    quote: 'bg-green-100 text-green-800',
    schedule: 'bg-blue-100 text-blue-800',
    question: 'bg-purple-100 text-purple-800',
    complaint: 'bg-red-100 text-red-800',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Voice Call History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading calls...
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No voice calls yet
          </div>
        ) : (
          <div className="space-y-4">
            {calls.map((call) => (
              <div
                key={call.id}
                className="p-4 border rounded-lg space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{call.from}</span>
                    <Badge className={intentColors[call.callerIntent] || ''}>
                      {call.callerIntent || 'unknown'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {formatDuration(call.duration)}
                  </div>
                </div>

                {call.aiSummary && (
                  <p className="text-sm text-muted-foreground">
                    {call.aiSummary}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(call.startedAt), {
                      addSuffix: true,
                    })}
                  </span>
                  <div className="flex gap-2">
                    {call.recordingUrl && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={call.recordingUrl} target="_blank">
                          <Play className="h-4 w-4 mr-1" />
                          Play
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm">
                      <FileText className="h-4 w-4 mr-1" />
                      Transcript
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/db/schema.ts` | Modified - Add voice fields |
| `src/app/api/webhooks/twilio/voice/route.ts` | Created |
| `src/app/api/webhooks/twilio/voice/gather/route.ts` | Created |
| `src/app/api/webhooks/twilio/voice/transfer/route.ts` | Created |
| `src/lib/services/voice-summary.ts` | Created |
| `src/components/settings/voice-settings.tsx` | Created |
| `src/components/voice/call-history.tsx` | Created |

---

## Twilio Configuration

1. In Twilio Console, set Voice webhook:
   - URL: `https://yourdomain.com/api/webhooks/twilio/voice`
   - Method: POST

2. Enable Enhanced Speech Recognition:
   - Requires Twilio Voice Intelligence add-on

3. Enable Recording:
   - May require compliance with recording laws (two-party consent)

---

## Cost Considerations

| Component | Cost |
|-----------|------|
| Twilio Voice | ~$0.013/min inbound |
| Twilio Speech Recognition | ~$0.02/min |
| OpenAI GPT-4o-mini | ~$0.001/call |
| Recording Storage | ~$0.0025/min/month |
| **Total per call (2 min avg)** | **~$0.07** |

At 100 calls/day = ~$210/month just for voice AI.

---

## Alternative: OpenAI Realtime API

For more natural conversations, consider OpenAI's Realtime API:

```typescript
// Using OpenAI Realtime with Twilio Media Streams
import WebSocket from 'ws';

// In voice webhook, connect to OpenAI Realtime
const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime', {
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'OpenAI-Beta': 'realtime=v1',
  },
});

// Stream audio between Twilio and OpenAI
// This creates a true conversational experience
```

---

## Verification

```bash
# 1. Run migrations
npx drizzle-kit generate
npx drizzle-kit migrate

# 2. Configure Twilio webhook
# In Twilio Console, point voice URL to your endpoint

# 3. Enable voice for a client
curl -X PATCH http://localhost:3000/api/clients/[CLIENT_ID] \
  -H "Content-Type: application/json" \
  -d '{"voiceEnabled": true, "voiceMode": "after_hours"}'

# 4. Test call
# Call the Twilio number after hours
# AI should answer and converse
```

## Success Criteria
- [ ] AI answers calls based on mode
- [ ] Speech recognized and transcribed
- [ ] AI generates appropriate responses
- [ ] Transfers to human when needed
- [ ] Call summary sent to owner
- [ ] Recording stored and playable
- [ ] Call history visible in dashboard

## Future Enhancements
- Real-time voice with OpenAI Realtime API
- Custom voice cloning with ElevenLabs
- Appointment booking during call
- Payment collection via phone
- Outbound AI calls for reminders
