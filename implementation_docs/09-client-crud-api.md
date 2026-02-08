# Phase 10a: Client CRUD API

## Current State (after Phase 9)
- Admin system with client selector
- Team escalation and hot transfers working
- No way to create/edit clients from UI

## Goal
Add API routes for client CRUD operations (admin only).

---

## Step 1: Create Clients API Route

**CREATE** `src/app/api/admin/clients/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const allClients = await db
    .select()
    .from(clients)
    .orderBy(desc(clients.createdAt));

  return NextResponse.json({ clients: allClients });
}

const createClientSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  ownerName: z.string().min(1, 'Owner name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Phone number is required'),
  timezone: z.string().default('America/Edmonton'),
  googleBusinessUrl: z.string().url().optional().or(z.literal('')),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createClientSchema.parse(body);

    // Check if email already exists
    const [existing] = await db
      .select()
      .from(clients)
      .where(eq(clients.email, data.email))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: 'A client with this email already exists' },
        { status: 400 }
      );
    }

    const [client] = await db
      .insert(clients)
      .values({
        businessName: data.businessName,
        ownerName: data.ownerName,
        email: data.email,
        phone: normalizePhoneNumber(data.phone),
        timezone: data.timezone,
        googleBusinessUrl: data.googleBusinessUrl || null,
        status: 'pending', // Not active until Twilio number assigned
      })
      .returning();

    return NextResponse.json({ client });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('Create client error:', error);
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 500 }
    );
  }
}
```

---

## Step 2: Create Single Client API Route

**CREATE** `src/app/api/admin/clients/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, params.id))
    .limit(1);

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  return NextResponse.json({ client });
}

const updateClientSchema = z.object({
  businessName: z.string().min(1).optional(),
  ownerName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  timezone: z.string().optional(),
  googleBusinessUrl: z.string().url().optional().or(z.literal('')).or(z.null()),
  twilioNumber: z.string().optional().or(z.null()),
  notificationEmail: z.boolean().optional(),
  notificationSms: z.boolean().optional(),
  monthlyMessageLimit: z.number().min(0).optional(),
  status: z.enum(['pending', 'active', 'paused', 'cancelled']).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = updateClientSchema.parse(body);

    // Normalize phone if provided
    if (data.phone) {
      data.phone = normalizePhoneNumber(data.phone);
    }

    const [updated] = await db
      .update(clients)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, params.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ client: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('Update client error:', error);
    return NextResponse.json(
      { error: 'Failed to update client' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Soft delete - set status to cancelled
  const [updated] = await db
    .update(clients)
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
    })
    .where(eq(clients.id, params.id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
```

---

## Step 3: Create Admin Users API Route

**CREATE** `src/app/api/admin/users/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, clients } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isAdmin: users.isAdmin,
      clientId: users.clientId,
      clientName: clients.businessName,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(clients, eq(users.clientId, clients.id))
    .orderBy(desc(users.createdAt));

  return NextResponse.json({ users: allUsers });
}
```

---

## Step 4: Create Single User API Route

**CREATE** `src/app/api/admin/users/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateUserSchema = z.object({
  isAdmin: z.boolean().optional(),
  clientId: z.string().uuid().optional().or(z.null()),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Prevent demoting yourself
  if (params.id === session.user.id) {
    const body = await request.json();
    if (body.isAdmin === false) {
      return NextResponse.json(
        { error: 'Cannot remove your own admin access' },
        { status: 400 }
      );
    }
  }

  try {
    const body = await request.json();
    const data = updateUserSchema.parse(body);

    const [updated] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, params.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
```

---

## Step 5: Create Client Stats API

**CREATE** `src/app/api/admin/clients/[id]/stats/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { leads, conversations, dailyStats, teamMembers } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const clientId = params.id;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get lead counts
  const leadCounts = await db
    .select({
      total: sql<number>`count(*)`,
      actionRequired: sql<number>`count(*) filter (where ${leads.actionRequired} = true)`,
    })
    .from(leads)
    .where(eq(leads.clientId, clientId));

  // Get 7-day stats
  const weekStats = await db
    .select({
      missedCalls: sql<number>`COALESCE(SUM(${dailyStats.missedCallsCaptured}), 0)`,
      forms: sql<number>`COALESCE(SUM(${dailyStats.formsResponded}), 0)`,
      messages: sql<number>`COALESCE(SUM(${dailyStats.messagesSent}), 0)`,
    })
    .from(dailyStats)
    .where(and(
      eq(dailyStats.clientId, clientId),
      gte(dailyStats.date, sevenDaysAgo.toISOString().split('T')[0])
    ));

  // Get team member count
  const teamCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(teamMembers)
    .where(and(
      eq(teamMembers.clientId, clientId),
      eq(teamMembers.isActive, true)
    ));

  return NextResponse.json({
    stats: {
      totalLeads: Number(leadCounts[0]?.total || 0),
      actionRequired: Number(leadCounts[0]?.actionRequired || 0),
      leadsThisWeek: Number(weekStats[0]?.missedCalls || 0) + Number(weekStats[0]?.forms || 0),
      messagesThisWeek: Number(weekStats[0]?.messages || 0),
      teamMembers: Number(teamCount[0]?.count || 0),
    },
  });
}
```

---

## Verify

1. `npm run dev`
2. Test API with curl (as admin):
   ```bash
   # Get all clients
   curl http://localhost:3000/api/admin/clients
   
   # Create client
   curl -X POST http://localhost:3000/api/admin/clients \
     -H "Content-Type: application/json" \
     -d '{"businessName":"Test Co","ownerName":"John","email":"john@test.com","phone":"4035551234"}'
   ```
3. Should require admin session (403 if not admin)

---

## Next
Proceed to **Phase 10b** for client management UI pages.
