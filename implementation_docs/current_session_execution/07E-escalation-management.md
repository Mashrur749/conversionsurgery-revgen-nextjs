# Phase 38: Escalation Management

## Prerequisites
- Phase 36 (Conversation Agent Schema) complete
- Phase 37 (Conversation Agent Core) complete
- Phase 17 (CRM Conversations) complete

## Goal
Build the human handoff system including:
1. Escalation queue dashboard for team members
2. Escalation rules configuration UI
3. Conversation takeover/release flow
4. SLA tracking and notifications
5. Escalation analytics

---

## Step 1: Create Escalation Service

**CREATE** `src/lib/services/escalation.ts`:

```typescript
import { db } from '@/lib/db';
import { 
  escalationQueue, 
  escalationRules, 
  leadContext,
  teamMembers,
  leads,
  clients,
  messages,
} from '@/lib/db/schema';
import { eq, and, desc, sql, isNull, or } from 'drizzle-orm';
import { sendSMS } from '@/lib/clients/twilio-tracked';
import { sendEmail } from '@/lib/services/email';
import { sendPushNotification } from '@/lib/services/push-notifications';

interface CreateEscalationParams {
  leadId: string;
  clientId: string;
  reason: string;
  reasonDetails?: string;
  triggerMessageId?: string;
  priority?: number;
  conversationSummary?: string;
  suggestedResponse?: string;
}

/**
 * Create a new escalation and notify appropriate team members
 */
export async function createEscalation(params: CreateEscalationParams): Promise<string> {
  const {
    leadId,
    clientId,
    reason,
    reasonDetails,
    triggerMessageId,
    priority = 3,
    conversationSummary,
    suggestedResponse,
  } = params;
  
  // Check for existing pending escalation for this lead
  const [existing] = await db
    .select()
    .from(escalationQueue)
    .where(and(
      eq(escalationQueue.leadId, leadId),
      eq(escalationQueue.status, 'pending')
    ))
    .limit(1);
  
  if (existing) {
    // Update priority if new one is higher
    if (priority < existing.priority) {
      await db.update(escalationQueue).set({
        priority,
        reasonDetails: reasonDetails || existing.reasonDetails,
        updatedAt: new Date(),
      }).where(eq(escalationQueue.id, existing.id));
    }
    return existing.id;
  }
  
  // Find matching rule for assignment
  const rules = await db
    .select()
    .from(escalationRules)
    .where(and(
      eq(escalationRules.clientId, clientId),
      eq(escalationRules.enabled, true)
    ))
    .orderBy(escalationRules.priority);
  
  let assignTo: string | null = null;
  let notifyVia: string[] = ['push'];
  let autoResponse: string | null = null;
  
  for (const rule of rules) {
    const conditions = rule.conditions as any;
    const action = rule.action as any;
    
    // Check if rule matches (simplified - in reality would check all conditions)
    const reasonMatches = conditions.triggers?.some((t: any) => 
      t.type === 'keyword' && reason.toLowerCase().includes(t.value.toLowerCase())
    );
    
    if (reasonMatches || conditions.triggers?.some((t: any) => t.type === reason)) {
      assignTo = action.assignTo;
      notifyVia = action.notifyVia || ['push'];
      autoResponse = action.autoResponse;
      
      // Update rule stats
      await db.update(escalationRules).set({
        timesTriggered: (rule.timesTriggered || 0) + 1,
        lastTriggeredAt: new Date(),
      }).where(eq(escalationRules.id, rule.id));
      
      break;
    }
  }
  
  // Resolve assignment
  let assignedTo: string | null = null;
  
  if (assignTo === 'owner') {
    // Get client owner
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);
    assignedTo = client?.ownerId || null;
  } else if (assignTo === 'round_robin') {
    // Get next available team member
    const members = await db
      .select()
      .from(teamMembers)
      .where(and(
        eq(teamMembers.clientId, clientId),
        eq(teamMembers.status, 'active')
      ));
    
    if (members.length > 0) {
      // Simple round-robin based on who has fewest pending
      const withCounts = await Promise.all(members.map(async (m) => {
        const [result] = await db
          .select({ count: sql<number>`count(*)` })
          .from(escalationQueue)
          .where(and(
            eq(escalationQueue.assignedTo, m.id),
            eq(escalationQueue.status, 'pending')
          ));
        return { ...m, pendingCount: result?.count || 0 };
      }));
      
      withCounts.sort((a, b) => a.pendingCount - b.pendingCount);
      assignedTo = withCounts[0]?.id || null;
    }
  } else if (assignTo) {
    assignedTo = assignTo;
  }
  
  // Calculate SLA deadline (default 1 hour for priority 1-2, 4 hours for others)
  const slaHours = priority <= 2 ? 1 : 4;
  const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);
  
  // Create escalation
  const [escalation] = await db.insert(escalationQueue).values({
    leadId,
    clientId,
    reason: reason as any,
    reasonDetails,
    triggerMessageId,
    priority,
    conversationSummary,
    suggestedResponse,
    status: assignedTo ? 'assigned' : 'pending',
    assignedTo,
    assignedAt: assignedTo ? new Date() : null,
    slaDeadline,
  }).returning();
  
  // Update lead context
  await db.update(leadContext).set({
    stage: 'escalated',
    stageChangedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(leadContext.leadId, leadId));
  
  // Send notifications
  await notifyEscalation(escalation.id, assignedTo, notifyVia);
  
  // Send auto-response if configured
  if (autoResponse) {
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    
    if (lead && client?.twilioPhoneNumber) {
      await sendSMS({
        clientId,
        to: lead.phone,
        from: client.twilioPhoneNumber,
        body: autoResponse,
        leadId,
      });
    }
  }
  
  return escalation.id;
}

/**
 * Send notifications for an escalation
 */
async function notifyEscalation(
  escalationId: string, 
  assignedTo: string | null, 
  channels: string[]
): Promise<void> {
  const [escalation] = await db
    .select()
    .from(escalationQueue)
    .where(eq(escalationQueue.id, escalationId))
    .limit(1);
  
  if (!escalation) return;
  
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, escalation.leadId))
    .limit(1);
  
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, escalation.clientId))
    .limit(1);
  
  // Get recipients - assigned person or all team members
  let recipients: any[] = [];
  
  if (assignedTo) {
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, assignedTo))
      .limit(1);
    if (member) recipients.push(member);
  } else {
    recipients = await db
      .select()
      .from(teamMembers)
      .where(and(
        eq(teamMembers.clientId, escalation.clientId),
        eq(teamMembers.status, 'active'),
        eq(teamMembers.canReceiveEscalations, true)
      ));
  }
  
  const priorityLabel = escalation.priority === 1 ? '🔴 URGENT' : 
                        escalation.priority === 2 ? '🟠 High' : '🟡 Normal';
  
  const message = `${priorityLabel}: ${lead?.name || 'Lead'} needs attention. Reason: ${escalation.reason}`;
  
  for (const recipient of recipients) {
    // SMS notification
    if (channels.includes('sms') && recipient.phone) {
      await sendSMS({
        clientId: escalation.clientId,
        to: recipient.phone,
        from: client?.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER!,
        body: message + ` View: ${process.env.NEXT_PUBLIC_APP_URL}/escalations/${escalation.id}`,
      });
    }
    
    // Email notification
    if (channels.includes('email') && recipient.email) {
      await sendEmail({
        to: recipient.email,
        subject: `[${client?.businessName}] Escalation: ${lead?.name}`,
        html: `
          <h2>${priorityLabel}</h2>
          <p><strong>Lead:</strong> ${lead?.name || 'Unknown'}</p>
          <p><strong>Phone:</strong> ${lead?.phone}</p>
          <p><strong>Reason:</strong> ${escalation.reason}</p>
          <p><strong>Details:</strong> ${escalation.reasonDetails || 'None'}</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/escalations/${escalation.id}">View Escalation</a></p>
        `,
      });
    }
    
    // Push notification
    if (channels.includes('push')) {
      await sendPushNotification({
        userId: recipient.userId || recipient.id,
        title: `Escalation: ${lead?.name}`,
        body: message,
        url: `/escalations/${escalation.id}`,
      });
    }
  }
}

/**
 * Assign an escalation to a team member
 */
export async function assignEscalation(
  escalationId: string, 
  teamMemberId: string
): Promise<void> {
  await db.update(escalationQueue).set({
    assignedTo: teamMemberId,
    assignedAt: new Date(),
    status: 'assigned',
    updatedAt: new Date(),
  }).where(eq(escalationQueue.id, escalationId));
}

/**
 * Take over a conversation (human starts responding)
 */
export async function takeOverConversation(
  escalationId: string,
  teamMemberId: string
): Promise<void> {
  await db.update(escalationQueue).set({
    status: 'in_progress',
    assignedTo: teamMemberId,
    firstResponseAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(escalationQueue.id, escalationId));
}

/**
 * Resolve an escalation
 */
export async function resolveEscalation(
  escalationId: string,
  teamMemberId: string,
  resolution: string,
  notes?: string,
  returnToAi: boolean = true
): Promise<void> {
  const [escalation] = await db
    .select()
    .from(escalationQueue)
    .where(eq(escalationQueue.id, escalationId))
    .limit(1);
  
  if (!escalation) throw new Error('Escalation not found');
  
  await db.update(escalationQueue).set({
    status: 'resolved',
    resolvedAt: new Date(),
    resolvedBy: teamMemberId,
    resolution: resolution as any,
    resolutionNotes: notes,
    returnToAi,
    updatedAt: new Date(),
  }).where(eq(escalationQueue.id, escalationId));
  
  // Update lead context based on resolution
  let newStage = 'qualifying';
  if (resolution === 'converted') newStage = 'booked';
  if (resolution === 'lost') newStage = 'lost';
  if (resolution === 'returned_to_ai') newStage = 'nurturing';
  
  await db.update(leadContext).set({
    stage: newStage as any,
    stageChangedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(leadContext.leadId, escalation.leadId));
}

/**
 * Get escalation queue for a client
 */
export async function getEscalationQueue(
  clientId: string,
  options?: {
    status?: string;
    assignedTo?: string;
    priority?: number;
  }
) {
  let query = db
    .select({
      escalation: escalationQueue,
      lead: leads,
      assignee: teamMembers,
    })
    .from(escalationQueue)
    .leftJoin(leads, eq(escalationQueue.leadId, leads.id))
    .leftJoin(teamMembers, eq(escalationQueue.assignedTo, teamMembers.id))
    .where(eq(escalationQueue.clientId, clientId))
    .orderBy(escalationQueue.priority, desc(escalationQueue.createdAt));
  
  // Apply filters
  const conditions = [eq(escalationQueue.clientId, clientId)];
  
  if (options?.status) {
    conditions.push(eq(escalationQueue.status, options.status));
  }
  
  if (options?.assignedTo) {
    conditions.push(eq(escalationQueue.assignedTo, options.assignedTo));
  }
  
  if (options?.priority) {
    conditions.push(eq(escalationQueue.priority, options.priority));
  }
  
  return db
    .select({
      escalation: escalationQueue,
      lead: leads,
      assignee: teamMembers,
    })
    .from(escalationQueue)
    .leftJoin(leads, eq(escalationQueue.leadId, leads.id))
    .leftJoin(teamMembers, eq(escalationQueue.assignedTo, teamMembers.id))
    .where(and(...conditions))
    .orderBy(escalationQueue.priority, desc(escalationQueue.createdAt));
}

/**
 * Check for SLA breaches
 */
export async function checkSlaBreaches(): Promise<void> {
  const now = new Date();
  
  // Find escalations that have breached SLA
  const breached = await db
    .select()
    .from(escalationQueue)
    .where(and(
      or(
        eq(escalationQueue.status, 'pending'),
        eq(escalationQueue.status, 'assigned')
      ),
      eq(escalationQueue.slaBreach, false),
      sql`${escalationQueue.slaDeadline} < ${now}`
    ));
  
  for (const escalation of breached) {
    // Mark as breached
    await db.update(escalationQueue).set({
      slaBreach: true,
      updatedAt: new Date(),
    }).where(eq(escalationQueue.id, escalation.id));
    
    // Notify client owner
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, escalation.clientId))
      .limit(1);
    
    if (client?.ownerId) {
      await sendPushNotification({
        userId: client.ownerId,
        title: '⚠️ SLA Breach',
        body: `Escalation has exceeded response time SLA`,
        url: `/escalations/${escalation.id}`,
      });
    }
  }
}
```

---

## Step 2: Create Escalation Queue API Routes

**CREATE** `src/app/api/escalations/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEscalationQueue } from '@/lib/services/escalation';
import { db } from '@/lib/db';
import { escalationQueue } from '@/lib/db/schema';
import { eq, and, or, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const status = searchParams.get('status');
  const assignedTo = searchParams.get('assignedTo');
  
  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  }
  
  const queue = await getEscalationQueue(clientId, {
    status: status || undefined,
    assignedTo: assignedTo || undefined,
  });
  
  // Get summary counts
  const counts = await db
    .select({
      status: escalationQueue.status,
      count: sql<number>`count(*)`,
    })
    .from(escalationQueue)
    .where(eq(escalationQueue.clientId, clientId))
    .groupBy(escalationQueue.status);
  
  const summary = {
    pending: 0,
    assigned: 0,
    in_progress: 0,
    resolved: 0,
    slaBreached: 0,
  };
  
  for (const c of counts) {
    summary[c.status as keyof typeof summary] = Number(c.count);
  }
  
  // Count SLA breaches
  const [breached] = await db
    .select({ count: sql<number>`count(*)` })
    .from(escalationQueue)
    .where(and(
      eq(escalationQueue.clientId, clientId),
      eq(escalationQueue.slaBreach, true),
      or(
        eq(escalationQueue.status, 'pending'),
        eq(escalationQueue.status, 'assigned'),
        eq(escalationQueue.status, 'in_progress')
      )
    ));
  
  summary.slaBreached = Number(breached?.count || 0);
  
  return NextResponse.json({ queue, summary });
}
```

**CREATE** `src/app/api/escalations/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { escalationQueue, leads, messages, teamMembers } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const [escalation] = await db
    .select()
    .from(escalationQueue)
    .where(eq(escalationQueue.id, params.id))
    .limit(1);
  
  if (!escalation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  
  // Get lead details
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, escalation.leadId))
    .limit(1);
  
  // Get conversation history
  const conversation = await db
    .select()
    .from(messages)
    .where(eq(messages.leadId, escalation.leadId))
    .orderBy(desc(messages.createdAt))
    .limit(50);
  
  // Get assignee details
  let assignee = null;
  if (escalation.assignedTo) {
    [assignee] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, escalation.assignedTo))
      .limit(1);
  }
  
  return NextResponse.json({
    escalation,
    lead,
    conversation: conversation.reverse(),
    assignee,
  });
}
```

**CREATE** `src/app/api/escalations/[id]/assign/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assignEscalation } from '@/lib/services/escalation';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { teamMemberId } = await request.json();
  
  await assignEscalation(params.id, teamMemberId);
  
  return NextResponse.json({ success: true });
}
```

**CREATE** `src/app/api/escalations/[id]/takeover/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { takeOverConversation } from '@/lib/services/escalation';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { teamMemberId } = await request.json();
  
  await takeOverConversation(params.id, teamMemberId);
  
  return NextResponse.json({ success: true });
}
```

**CREATE** `src/app/api/escalations/[id]/resolve/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { resolveEscalation } from '@/lib/services/escalation';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { teamMemberId, resolution, notes, returnToAi } = await request.json();
  
  await resolveEscalation(params.id, teamMemberId, resolution, notes, returnToAi);
  
  return NextResponse.json({ success: true });
}
```

---

## Step 3: Create Escalation Rules API

**CREATE** `src/app/api/clients/[clientId]/escalation-rules/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { escalationRules } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

// GET - List all rules
export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const rules = await db
    .select()
    .from(escalationRules)
    .where(eq(escalationRules.clientId, params.clientId))
    .orderBy(asc(escalationRules.priority));
  
  return NextResponse.json(rules);
}

// POST - Create new rule
export async function POST(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const body = await request.json();
  
  const [rule] = await db.insert(escalationRules).values({
    clientId: params.clientId,
    name: body.name,
    description: body.description,
    conditions: body.conditions,
    action: body.action,
    priority: body.priority || 100,
    enabled: body.enabled ?? true,
  }).returning();
  
  return NextResponse.json(rule);
}
```

**CREATE** `src/app/api/clients/[clientId]/escalation-rules/[ruleId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { escalationRules } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// PUT - Update rule
export async function PUT(
  request: NextRequest,
  { params }: { params: { clientId: string; ruleId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const body = await request.json();
  
  const [rule] = await db
    .update(escalationRules)
    .set({
      name: body.name,
      description: body.description,
      conditions: body.conditions,
      action: body.action,
      priority: body.priority,
      enabled: body.enabled,
      updatedAt: new Date(),
    })
    .where(and(
      eq(escalationRules.id, params.ruleId),
      eq(escalationRules.clientId, params.clientId)
    ))
    .returning();
  
  return NextResponse.json(rule);
}

// DELETE - Delete rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { clientId: string; ruleId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  await db
    .delete(escalationRules)
    .where(and(
      eq(escalationRules.id, params.ruleId),
      eq(escalationRules.clientId, params.clientId)
    ));
  
  return NextResponse.json({ success: true });
}
```

---

## Step 4: Create Escalation Queue Page

**CREATE** `src/app/(dashboard)/escalations/page.tsx`:

```typescript
import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { EscalationQueue } from '@/components/escalations/escalation-queue';

export default async function EscalationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Escalation Queue</h1>
        <p className="text-muted-foreground">
          Conversations that need human attention
        </p>
      </div>
      
      <Suspense fallback={<div>Loading...</div>}>
        <EscalationQueue clientId={session.user.clientId} />
      </Suspense>
    </div>
  );
}
```

---

## Step 5: Create Escalation Queue Component

**CREATE** `src/components/escalations/escalation-queue.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  Clock,
  User,
  MessageSquare,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface EscalationQueueProps {
  clientId: string;
}

interface Escalation {
  escalation: {
    id: string;
    reason: string;
    reasonDetails: string;
    priority: number;
    status: string;
    slaBreach: boolean;
    slaDeadline: string;
    createdAt: string;
  };
  lead: {
    id: string;
    name: string;
    phone: string;
  };
  assignee: {
    id: string;
    name: string;
  } | null;
}

interface Summary {
  pending: number;
  assigned: number;
  in_progress: number;
  resolved: number;
  slaBreached: number;
}

export function EscalationQueue({ clientId }: EscalationQueueProps) {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState('active');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEscalations();
  }, [clientId, filter]);

  const fetchEscalations = async () => {
    setLoading(true);
    const statusFilter = filter === 'active' 
      ? '' 
      : filter === 'resolved' 
        ? 'resolved' 
        : filter;
    
    const res = await fetch(
      `/api/escalations?clientId=${clientId}${statusFilter ? `&status=${statusFilter}` : ''}`
    );
    const data = await res.json();
    setEscalations(data.queue);
    setSummary(data.summary);
    setLoading(false);
  };

  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 1:
        return <Badge variant="destructive">🔴 Urgent</Badge>;
      case 2:
        return <Badge className="bg-orange-500">🟠 High</Badge>;
      default:
        return <Badge variant="secondary">🟡 Normal</Badge>;
    }
  };

  const getStatusBadge = (status: string, slaBreach: boolean) => {
    if (slaBreach) {
      return <Badge variant="destructive">⚠️ SLA Breach</Badge>;
    }
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'assigned':
        return <Badge variant="secondary">Assigned</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500">In Progress</Badge>;
      case 'resolved':
        return <Badge className="bg-green-500">Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const activeCount = (summary?.pending || 0) + (summary?.assigned || 0) + (summary?.in_progress || 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.pending}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.in_progress}</div>
            </CardContent>
          </Card>
          
          <Card className={summary.slaBreached > 0 ? 'border-destructive' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">SLA Breached</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${summary.slaBreached > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.slaBreached > 0 ? 'text-destructive' : ''}`}>
                {summary.slaBreached}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="active" onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="active">
            Active ({activeCount})
          </TabsTrigger>
          <TabsTrigger value="pending">Pending ({summary?.pending || 0})</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress ({summary?.in_progress || 0})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({summary?.resolved || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : escalations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>No escalations in this queue</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {escalations.map(({ escalation, lead, assignee }) => (
                <Card 
                  key={escalation.id}
                  className={escalation.slaBreach ? 'border-destructive' : ''}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Priority */}
                        {getPriorityBadge(escalation.priority)}
                        
                        {/* Lead info */}
                        <div>
                          <div className="font-medium">{lead.name}</div>
                          <div className="text-sm text-muted-foreground">{lead.phone}</div>
                        </div>
                        
                        {/* Status */}
                        {getStatusBadge(escalation.status, escalation.slaBreach)}
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {/* Reason */}
                        <div className="text-right">
                          <div className="text-sm font-medium capitalize">
                            {escalation.reason.replace(/_/g, ' ')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(escalation.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                        
                        {/* Assignee */}
                        {assignee && (
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4" />
                            {assignee.name}
                          </div>
                        )}
                        
                        {/* Action */}
                        <Button asChild size="sm">
                          <Link href={`/escalations/${escalation.id}`}>
                            View
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## Step 6: Create Escalation Detail Page

**CREATE** `src/app/(dashboard)/escalations/[id]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { escalationQueue } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { EscalationDetail } from '@/components/escalations/escalation-detail';

interface PageProps {
  params: { id: string };
}

export default async function EscalationDetailPage({ params }: PageProps) {
  const [escalation] = await db
    .select()
    .from(escalationQueue)
    .where(eq(escalationQueue.id, params.id))
    .limit(1);

  if (!escalation) notFound();

  return <EscalationDetail escalationId={params.id} />;
}
```

**CREATE** `src/components/escalations/escalation-detail.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Phone,
  MessageSquare,
  User,
  Clock,
  CheckCircle,
  ArrowLeft,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

interface EscalationDetailProps {
  escalationId: string;
}

export function EscalationDetail({ escalationId }: EscalationDetailProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState('');
  const [sending, setSending] = useState(false);
  const [resolution, setResolution] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, [escalationId]);

  const fetchData = async () => {
    const res = await fetch(`/api/escalations/${escalationId}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  const handleTakeover = async () => {
    await fetch(`/api/escalations/${escalationId}/takeover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamMemberId: 'current-user-id' }), // Get from session
    });
    toast.success('Conversation taken over');
    fetchData();
  };

  const handleSendResponse = async () => {
    if (!response.trim()) return;
    
    setSending(true);
    await fetch(`/api/leads/${data.lead.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: response }),
    });
    
    setResponse('');
    setSending(false);
    toast.success('Message sent');
    fetchData();
  };

  const handleResolve = async () => {
    if (!resolution) {
      toast.error('Select a resolution');
      return;
    }
    
    await fetch(`/api/escalations/${escalationId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamMemberId: 'current-user-id',
        resolution,
        notes,
        returnToAi: resolution === 'returned_to_ai',
      }),
    });
    
    toast.success('Escalation resolved');
    fetchData();
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const { escalation, lead, conversation, assignee } = data;
  const isActive = ['pending', 'assigned', 'in_progress'].includes(escalation.status);

  return (
    <div className="container py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/escalations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{lead.name}</h1>
          <p className="text-muted-foreground">{lead.phone}</p>
        </div>
        {escalation.slaBreach && (
          <Badge variant="destructive" className="text-lg px-4 py-2">
            ⚠️ SLA BREACH
          </Badge>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column - Conversation */}
        <div className="md:col-span-2 space-y-4">
          {/* Conversation history */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {conversation.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.direction === 'outbound'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p>{msg.body}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {format(new Date(msg.createdAt), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Response input */}
          {isActive && (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {escalation.suggestedResponse && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Suggested response:</p>
                      <p className="text-sm">{escalation.suggestedResponse}</p>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="mt-2"
                        onClick={() => setResponse(escalation.suggestedResponse)}
                      >
                        Use this
                      </Button>
                    </div>
                  )}
                  
                  <Textarea
                    placeholder="Type your response..."
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={3}
                  />
                  
                  <div className="flex gap-2">
                    {escalation.status === 'assigned' && (
                      <Button variant="outline" onClick={handleTakeover}>
                        Take Over Conversation
                      </Button>
                    )}
                    <Button 
                      onClick={handleSendResponse} 
                      disabled={!response.trim() || sending}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Response
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column - Details */}
        <div className="space-y-4">
          {/* Escalation details */}
          <Card>
            <CardHeader>
              <CardTitle>Escalation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="font-medium capitalize">{escalation.reason.replace(/_/g, ' ')}</p>
              </div>
              
              {escalation.reasonDetails && (
                <div>
                  <p className="text-sm text-muted-foreground">Details</p>
                  <p>{escalation.reasonDetails}</p>
                </div>
              )}
              
              <div>
                <p className="text-sm text-muted-foreground">Priority</p>
                <Badge variant={escalation.priority === 1 ? 'destructive' : 'secondary'}>
                  {escalation.priority === 1 ? 'Urgent' : escalation.priority === 2 ? 'High' : 'Normal'}
                </Badge>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge>{escalation.status.replace(/_/g, ' ')}</Badge>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p>{formatDistanceToNow(new Date(escalation.createdAt), { addSuffix: true })}</p>
              </div>
              
              {assignee && (
                <div>
                  <p className="text-sm text-muted-foreground">Assigned to</p>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {assignee.name}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href={`tel:${lead.phone}`}>
                  <Phone className="h-4 w-4 mr-2" />
                  Call {lead.name}
                </a>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href={`/conversations/${lead.id}`}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  View Full History
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Resolution */}
          {isActive && (
            <Card>
              <CardHeader>
                <CardTitle>Resolve Escalation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select resolution" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="handled">Handled - Issue Resolved</SelectItem>
                    <SelectItem value="returned_to_ai">Return to AI</SelectItem>
                    <SelectItem value="converted">Converted - Booked Job</SelectItem>
                    <SelectItem value="lost">Lost - No Longer Interested</SelectItem>
                    <SelectItem value="no_action">No Action Needed</SelectItem>
                  </SelectContent>
                </Select>
                
                <Textarea
                  placeholder="Resolution notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
                
                <Button onClick={handleResolve} className="w-full">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Resolve
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Step 7: Add SLA Check Cron

**MODIFY** `src/app/api/cron/hourly/route.ts`:

```typescript
import { checkSlaBreaches } from '@/lib/services/escalation';

export async function GET() {
  // ... existing tasks ...
  
  // Check for SLA breaches
  await checkSlaBreaches();
  
  return NextResponse.json({ success: true });
}
```

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/services/escalation.ts` | Created |
| `src/app/api/escalations/route.ts` | Created |
| `src/app/api/escalations/[id]/route.ts` | Created |
| `src/app/api/escalations/[id]/assign/route.ts` | Created |
| `src/app/api/escalations/[id]/takeover/route.ts` | Created |
| `src/app/api/escalations/[id]/resolve/route.ts` | Created |
| `src/app/api/clients/[clientId]/escalation-rules/route.ts` | Created |
| `src/app/api/clients/[clientId]/escalation-rules/[ruleId]/route.ts` | Created |
| `src/app/(dashboard)/escalations/page.tsx` | Created |
| `src/app/(dashboard)/escalations/[id]/page.tsx` | Created |
| `src/components/escalations/escalation-queue.tsx` | Created |
| `src/components/escalations/escalation-detail.tsx` | Created |
| `src/app/api/cron/hourly/route.ts` | Modified |

---

## Verification

```bash
# 1. Create test escalation
curl -X POST http://localhost:3000/api/escalations \
  -H "Content-Type: application/json" \
  -d '{"leadId": "xxx", "clientId": "xxx", "reason": "explicit_request"}'

# 2. View escalation queue
open http://localhost:3000/escalations

# 3. Check SLA breach detection
SELECT * FROM escalation_queue WHERE sla_breach = true;

# 4. Test resolution flow
# - Take over conversation
# - Send response
# - Resolve escalation
```

---

## Success Criteria
- [ ] Escalation queue displays with priority sorting
- [ ] Team members can be assigned to escalations
- [ ] Conversation takeover pauses AI responses
- [ ] Response can be sent from escalation detail page
- [ ] Resolution updates lead stage appropriately
- [ ] SLA breaches detected and notified
- [ ] Escalation rules can be configured per client
- [ ] Notifications sent via SMS/email/push
