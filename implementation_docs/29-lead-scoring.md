# Phase 17b: Lead Scoring

## Prerequisites
- Phase 17a (Revenue Attribution) complete
- leads table exists with conversation history

## Goal
AI-powered lead scoring (0-100) based on conversation signals, enabling prioritization and smart routing.

---

## Step 1: Add Lead Score Fields

**MODIFY** `src/lib/db/schema.ts` - ADD to leads table:

```typescript
// In leads table definition, ADD these columns:
  score: integer('score').default(50),
  scoreUpdatedAt: timestamp('score_updated_at'),
  scoreFactors: jsonb('score_factors').$type<{
    urgency: number;        // 0-25 points
    budget: number;         // 0-25 points
    engagement: number;     // 0-25 points
    intent: number;         // 0-25 points
    signals: string[];      // detected signals
    lastAnalysis: string;   // timestamp
  }>(),
  temperature: varchar('temperature', { length: 10 }).default('warm'), // hot, warm, cold
```

Run migration:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## Step 2: Create Scoring Service

**CREATE** `src/lib/services/lead-scoring.ts`:

```typescript
import { db } from '@/lib/db';
import { leads, messages } from '@/lib/db/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ScoreFactors {
  urgency: number;
  budget: number;
  engagement: number;
  intent: number;
  signals: string[];
  lastAnalysis: string;
}

interface ScoringResult {
  score: number;
  temperature: 'hot' | 'warm' | 'cold';
  factors: ScoreFactors;
}

// Signal patterns for quick scoring (no AI needed)
const URGENCY_SIGNALS = {
  high: [
    /asap/i, /urgent/i, /emergency/i, /today/i, /right away/i,
    /leak/i, /flood/i, /damage/i, /broken/i, /not working/i,
    /insurance claim/i, /storm damage/i
  ],
  medium: [
    /this week/i, /soon/i, /schedule/i, /available/i,
    /when can you/i, /how soon/i
  ],
  low: [
    /just looking/i, /thinking about/i, /maybe/i, /someday/i,
    /no rush/i, /whenever/i, /next year/i
  ]
};

const BUDGET_SIGNALS = {
  high: [
    /money.*(not|isn't|isnt).*(issue|problem|concern)/i,
    /budget.*ready/i, /can afford/i, /approved/i,
    /insurance.*cover/i, /finance/i, /payment plan/i
  ],
  medium: [
    /how much/i, /cost/i, /price/i, /estimate/i, /quote/i
  ],
  low: [
    /too expensive/i, /can't afford/i, /budget.*tight/i,
    /cheaper/i, /discount/i, /too much/i
  ]
};

const INTENT_SIGNALS = {
  high: [
    /ready to (start|book|schedule|hire)/i,
    /let's (do it|proceed|move forward)/i,
    /when can you (start|come|begin)/i,
    /i want to/i, /we decided/i, /going with you/i
  ],
  medium: [
    /interested/i, /considering/i, /comparing/i,
    /tell me more/i, /what's included/i
  ],
  low: [
    /just (browsing|looking|curious)/i,
    /not sure/i, /still thinking/i, /maybe later/i
  ]
};

const SATISFACTION_SIGNALS = [
  /looks great/i, /amazing/i, /perfect/i, /love it/i,
  /thank you/i, /happy/i, /excellent/i, /wonderful/i,
  /recommend/i, /great job/i, /impressed/i
];

const FRUSTRATION_SIGNALS = [
  /disappointed/i, /frustrated/i, /upset/i, /angry/i,
  /taking too long/i, /not happy/i, /problem/i,
  /still waiting/i, /no response/i, /ignored/i
];

/**
 * Quick score based on pattern matching (fast, no AI)
 */
export function quickScore(conversationText: string): Partial<ScoreFactors> {
  const signals: string[] = [];
  let urgency = 12; // default medium
  let budget = 12;
  let intent = 12;
  
  // Check urgency
  if (URGENCY_SIGNALS.high.some(p => p.test(conversationText))) {
    urgency = 22;
    signals.push('high_urgency');
  } else if (URGENCY_SIGNALS.low.some(p => p.test(conversationText))) {
    urgency = 5;
    signals.push('low_urgency');
  } else if (URGENCY_SIGNALS.medium.some(p => p.test(conversationText))) {
    urgency = 15;
    signals.push('medium_urgency');
  }
  
  // Check budget
  if (BUDGET_SIGNALS.high.some(p => p.test(conversationText))) {
    budget = 22;
    signals.push('budget_ready');
  } else if (BUDGET_SIGNALS.low.some(p => p.test(conversationText))) {
    budget = 5;
    signals.push('price_sensitive');
  } else if (BUDGET_SIGNALS.medium.some(p => p.test(conversationText))) {
    budget = 12;
    signals.push('price_inquiry');
  }
  
  // Check intent
  if (INTENT_SIGNALS.high.some(p => p.test(conversationText))) {
    intent = 22;
    signals.push('high_intent');
  } else if (INTENT_SIGNALS.low.some(p => p.test(conversationText))) {
    intent = 5;
    signals.push('low_intent');
  } else if (INTENT_SIGNALS.medium.some(p => p.test(conversationText))) {
    intent = 12;
    signals.push('considering');
  }
  
  // Check satisfaction/frustration (affects overall)
  if (SATISFACTION_SIGNALS.some(p => p.test(conversationText))) {
    signals.push('satisfied');
  }
  if (FRUSTRATION_SIGNALS.some(p => p.test(conversationText))) {
    signals.push('frustrated');
    intent = Math.max(intent - 5, 0);
  }
  
  return { urgency, budget, intent, signals };
}

/**
 * Calculate engagement score based on response patterns
 */
export async function calculateEngagement(leadId: string): Promise<number> {
  const recentMessages = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.leadId, leadId),
        gte(messages.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // last 7 days
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(20);
  
  if (recentMessages.length === 0) return 5;
  
  const inbound = recentMessages.filter(m => m.direction === 'inbound').length;
  const outbound = recentMessages.filter(m => m.direction === 'outbound').length;
  
  // Response ratio
  const responseRatio = outbound > 0 ? inbound / outbound : 0;
  
  // Recent activity bonus
  const lastMessage = recentMessages[0];
  const hoursSinceLastMessage = lastMessage
    ? (Date.now() - new Date(lastMessage.createdAt!).getTime()) / (1000 * 60 * 60)
    : 999;
  
  let engagement = 12; // base
  
  // High response ratio = engaged
  if (responseRatio > 0.8) engagement += 8;
  else if (responseRatio > 0.5) engagement += 4;
  else if (responseRatio < 0.2) engagement -= 5;
  
  // Recent activity = engaged
  if (hoursSinceLastMessage < 1) engagement += 5;
  else if (hoursSinceLastMessage < 24) engagement += 3;
  else if (hoursSinceLastMessage > 72) engagement -= 5;
  
  return Math.max(0, Math.min(25, engagement));
}

/**
 * Full AI-powered scoring (slower, more accurate)
 */
export async function aiScore(conversationText: string): Promise<ScoreFactors> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a lead scoring AI for a contractor. Analyze this conversation and return a JSON score.

Score each factor 0-25:
- urgency: How urgent is their need? (emergency=25, browsing=0)
- budget: Are they ready to pay? (budget ready=25, price sensitive=0)
- intent: How ready to hire? (ready now=25, just looking=0)

Also list detected signals as strings.

Return ONLY valid JSON:
{
  "urgency": <number>,
  "budget": <number>,
  "intent": <number>,
  "signals": ["signal1", "signal2"]
}`
      },
      {
        role: 'user',
        content: `Conversation:\n${conversationText}`
      }
    ],
    temperature: 0.3,
    max_tokens: 200,
  });
  
  try {
    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      urgency: Math.min(25, Math.max(0, result.urgency || 12)),
      budget: Math.min(25, Math.max(0, result.budget || 12)),
      intent: Math.min(25, Math.max(0, result.intent || 12)),
      engagement: 0, // calculated separately
      signals: result.signals || [],
      lastAnalysis: new Date().toISOString(),
    };
  } catch {
    // Fallback to quick score
    const quick = quickScore(conversationText);
    return {
      urgency: quick.urgency || 12,
      budget: quick.budget || 12,
      intent: quick.intent || 12,
      engagement: 0,
      signals: quick.signals || [],
      lastAnalysis: new Date().toISOString(),
    };
  }
}

/**
 * Main scoring function - combines all factors
 */
export async function scoreLead(
  leadId: string,
  options: { useAI?: boolean } = {}
): Promise<ScoringResult> {
  // Get recent conversation
  const recentMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.leadId, leadId))
    .orderBy(desc(messages.createdAt))
    .limit(30);
  
  const conversationText = recentMessages
    .reverse()
    .map(m => `${m.direction === 'inbound' ? 'Lead' : 'Us'}: ${m.content}`)
    .join('\n');
  
  // Get factors
  let factors: ScoreFactors;
  
  if (options.useAI && conversationText.length > 50) {
    factors = await aiScore(conversationText);
  } else {
    const quick = quickScore(conversationText);
    factors = {
      urgency: quick.urgency || 12,
      budget: quick.budget || 12,
      intent: quick.intent || 12,
      engagement: 0,
      signals: quick.signals || [],
      lastAnalysis: new Date().toISOString(),
    };
  }
  
  // Calculate engagement
  factors.engagement = await calculateEngagement(leadId);
  
  // Total score
  const score = factors.urgency + factors.budget + factors.engagement + factors.intent;
  
  // Temperature
  let temperature: 'hot' | 'warm' | 'cold';
  if (score >= 70) temperature = 'hot';
  else if (score >= 40) temperature = 'warm';
  else temperature = 'cold';
  
  // Update lead in database
  await db
    .update(leads)
    .set({
      score,
      temperature,
      scoreFactors: factors,
      scoreUpdatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));
  
  return { score, temperature, factors };
}

/**
 * Batch score all leads for a client
 */
export async function scoreClientLeads(
  clientId: string,
  options: { useAI?: boolean } = {}
): Promise<{ updated: number; errors: number }> {
  const clientLeads = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.clientId, clientId));
  
  let updated = 0;
  let errors = 0;
  
  for (const lead of clientLeads) {
    try {
      await scoreLead(lead.id, options);
      updated++;
    } catch (err) {
      console.error(`Error scoring lead ${lead.id}:`, err);
      errors++;
    }
  }
  
  return { updated, errors };
}

/**
 * Get leads by temperature for a client
 */
export async function getLeadsByTemperature(
  clientId: string,
  temperature: 'hot' | 'warm' | 'cold'
) {
  return db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.clientId, clientId),
        eq(leads.temperature, temperature)
      )
    )
    .orderBy(desc(leads.score));
}
```

---

## Step 3: Score on Message Received

**MODIFY** `src/app/api/webhooks/twilio/incoming/route.ts`:

ADD at the end of the handler, after saving the message:

```typescript
import { scoreLead } from '@/lib/services/lead-scoring';

// ... existing code ...

// After saving inbound message, update lead score
// Use quick scoring for speed (no AI call)
await scoreLead(lead.id, { useAI: false });

// If high-value signals detected, do full AI scoring async
const quickFactors = quickScore(body);
if (
  quickFactors.signals?.includes('high_urgency') ||
  quickFactors.signals?.includes('high_intent') ||
  quickFactors.signals?.includes('budget_ready')
) {
  // Fire and forget - full AI scoring
  scoreLead(lead.id, { useAI: true }).catch(console.error);
}
```

---

## Step 4: Create Scoring API

**CREATE** `src/app/api/leads/[id]/score/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { scoreLead, getLeadsByTemperature } from '@/lib/services/lead-scoring';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// GET - Get lead score
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lead = await db
    .select({
      id: leads.id,
      score: leads.score,
      temperature: leads.temperature,
      scoreFactors: leads.scoreFactors,
      scoreUpdatedAt: leads.scoreUpdatedAt,
    })
    .from(leads)
    .where(eq(leads.id, params.id))
    .limit(1);

  if (!lead.length) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  return NextResponse.json(lead[0]);
}

// POST - Recalculate score
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { useAI = true } = await request.json().catch(() => ({}));

  const result = await scoreLead(params.id, { useAI });

  return NextResponse.json(result);
}
```

**CREATE** `src/app/api/clients/[id]/leads/scores/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { scoreClientLeads, getLeadsByTemperature } from '@/lib/services/lead-scoring';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

// GET - Get score distribution for client
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const distribution = await db
    .select({
      temperature: leads.temperature,
      count: sql<number>`count(*)::int`,
      avgScore: sql<number>`avg(score)::int`,
    })
    .from(leads)
    .where(eq(leads.clientId, params.id))
    .groupBy(leads.temperature);

  const hotLeads = await getLeadsByTemperature(params.id, 'hot');
  
  return NextResponse.json({
    distribution,
    hotLeads: hotLeads.slice(0, 10), // top 10 hot leads
  });
}

// POST - Batch rescore all leads
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { useAI = false } = await request.json().catch(() => ({}));

  const result = await scoreClientLeads(params.id, { useAI });

  return NextResponse.json(result);
}
```

---

## Step 5: Lead Score UI Component

**CREATE** `src/components/leads/lead-score-badge.tsx`:

```typescript
'use client';

import { cn } from '@/lib/utils';
import { Flame, Thermometer, Snowflake, TrendingUp, TrendingDown } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LeadScoreBadgeProps {
  score: number;
  temperature: 'hot' | 'warm' | 'cold';
  factors?: {
    urgency: number;
    budget: number;
    engagement: number;
    intent: number;
    signals: string[];
  };
  compact?: boolean;
}

export function LeadScoreBadge({
  score,
  temperature,
  factors,
  compact = false,
}: LeadScoreBadgeProps) {
  const config = {
    hot: {
      icon: Flame,
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800',
      label: 'Hot',
    },
    warm: {
      icon: Thermometer,
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-700 dark:text-yellow-400',
      border: 'border-yellow-200 dark:border-yellow-800',
      label: 'Warm',
    },
    cold: {
      icon: Snowflake,
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800',
      label: 'Cold',
    },
  };

  const { icon: Icon, bg, text, border, label } = config[temperature];

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
                bg,
                text,
                border
              )}
            >
              <Icon className="h-3 w-3" />
              <span>{score}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <p className="font-medium">{label} Lead - Score: {score}/100</p>
              {factors && (
                <div className="mt-1 text-xs space-y-0.5">
                  <p>Urgency: {factors.urgency}/25</p>
                  <p>Budget: {factors.budget}/25</p>
                  <p>Intent: {factors.intent}/25</p>
                  <p>Engagement: {factors.engagement}/25</p>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        bg,
        border
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', text)} />
          <span className={cn('font-semibold', text)}>{label}</span>
        </div>
        <span className={cn('text-2xl font-bold', text)}>{score}</span>
      </div>
      
      {factors && (
        <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
          <div className="text-center">
            <div className="font-medium text-muted-foreground">Urgency</div>
            <div className={cn('font-semibold', text)}>{factors.urgency}/25</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-muted-foreground">Budget</div>
            <div className={cn('font-semibold', text)}>{factors.budget}/25</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-muted-foreground">Intent</div>
            <div className={cn('font-semibold', text)}>{factors.intent}/25</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-muted-foreground">Engage</div>
            <div className={cn('font-semibold', text)}>{factors.engagement}/25</div>
          </div>
        </div>
      )}
      
      {factors?.signals && factors.signals.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {factors.signals.map((signal) => (
            <span
              key={signal}
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-xs',
                'bg-white/50 dark:bg-black/20'
              )}
            >
              {signal.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Step 6: Lead Score Distribution Chart

**CREATE** `src/components/leads/lead-score-distribution.tsx`:

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Flame, Thermometer, Snowflake } from 'lucide-react';

interface ScoreDistributionProps {
  distribution: {
    temperature: string;
    count: number;
    avgScore: number;
  }[];
  hotLeads: {
    id: string;
    name: string;
    phone: string;
    score: number;
  }[];
}

export function LeadScoreDistribution({
  distribution,
  hotLeads,
}: ScoreDistributionProps) {
  const hot = distribution.find(d => d.temperature === 'hot');
  const warm = distribution.find(d => d.temperature === 'warm');
  const cold = distribution.find(d => d.temperature === 'cold');
  const total = (hot?.count || 0) + (warm?.count || 0) + (cold?.count || 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lead Temperature</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Distribution bar */}
          <div className="flex h-8 rounded-full overflow-hidden mb-4">
            {hot && hot.count > 0 && (
              <div
                className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${(hot.count / total) * 100}%` }}
              >
                {hot.count}
              </div>
            )}
            {warm && warm.count > 0 && (
              <div
                className="bg-yellow-500 flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${(warm.count / total) * 100}%` }}
              >
                {warm.count}
              </div>
            )}
            {cold && cold.count > 0 && (
              <div
                className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${(cold.count / total) * 100}%` }}
              >
                {cold.count}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              <span>Hot ({hot?.count || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-yellow-500" />
              <span>Warm ({warm?.count || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-blue-500" />
              <span>Cold ({cold?.count || 0})</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hot Leads List */}
      {hotLeads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="h-5 w-5 text-red-500" />
              Hot Leads - Priority Follow-up
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {hotLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-2 rounded bg-red-50 dark:bg-red-900/20"
                >
                  <div>
                    <p className="font-medium">{lead.name}</p>
                    <p className="text-sm text-muted-foreground">{lead.phone}</p>
                  </div>
                  <div className="text-lg font-bold text-red-600">
                    {lead.score}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

## Step 7: Add Score to CRM List

**MODIFY** `src/components/crm/conversation-list.tsx`:

ADD import and use LeadScoreBadge:

```typescript
import { LeadScoreBadge } from '@/components/leads/lead-score-badge';

// In the conversation list item, add:
<div className="flex items-center gap-2">
  <LeadScoreBadge
    score={lead.score || 50}
    temperature={(lead.temperature as 'hot' | 'warm' | 'cold') || 'warm'}
    compact
  />
  {/* ... existing status badges ... */}
</div>
```

---

## Step 8: Cron Job for Daily Scoring

**MODIFY** `src/app/api/cron/daily/route.ts`:

ADD lead scoring refresh:

```typescript
import { scoreClientLeads } from '@/lib/services/lead-scoring';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// In the daily cron handler, ADD:
// Rescore all leads (quick mode, no AI)
const activeClients = await db
  .select({ id: clients.id })
  .from(clients)
  .where(eq(clients.isActive, true));

for (const client of activeClients) {
  await scoreClientLeads(client.id, { useAI: false });
}
console.log(`Rescored leads for ${activeClients.length} clients`);
```

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/db/schema.ts` | Modified - Add score columns |
| `src/lib/services/lead-scoring.ts` | Created |
| `src/app/api/leads/[id]/score/route.ts` | Created |
| `src/app/api/clients/[id]/leads/scores/route.ts` | Created |
| `src/components/leads/lead-score-badge.tsx` | Created |
| `src/components/leads/lead-score-distribution.tsx` | Created |
| `src/components/crm/conversation-list.tsx` | Modified |
| `src/app/api/webhooks/twilio/incoming/route.ts` | Modified |
| `src/app/api/cron/daily/route.ts` | Modified |

---

## Verification

```bash
# 1. Run migration
npx drizzle-kit generate
npx drizzle-kit migrate

# 2. Test scoring API
curl -X POST http://localhost:3000/api/leads/[LEAD_ID]/score \
  -H "Content-Type: application/json" \
  -d '{"useAI": true}'

# 3. Check score distribution
curl http://localhost:3000/api/clients/[CLIENT_ID]/leads/scores

# 4. Verify in UI - lead cards should show temperature badges
```

## Success Criteria
- [ ] Lead scores calculate on message receive
- [ ] Temperature badges visible in CRM list
- [ ] Hot leads surfaced in dashboard
- [ ] Batch rescoring works via API
- [ ] Score factors show in tooltip
