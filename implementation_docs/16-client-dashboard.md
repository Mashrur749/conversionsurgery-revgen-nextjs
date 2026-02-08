# Phase 12a: Client Dashboard (Magic Link Auth)

## Current State (after Phase 11)
- Admin can manage all clients
- Clients have no way to view their own data
- Team members only receive SMS escalations

## Goal
Mobile-first client dashboard with magic link auth (no passwords).

---

## Step 1: Add Magic Link Token Table

**APPEND** to `src/lib/db/schema.ts` (before RELATIONS):

```typescript
// ============================================
// MAGIC LINK TOKENS
// ============================================
export const magicLinkTokens = pgTable('magic_link_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  tokenIdx: index('idx_magic_link_tokens_token').on(table.token),
}));
```

**APPEND** to relations:

```typescript
export const magicLinkTokensRelations = relations(magicLinkTokens, ({ one }) => ({
  client: one(clients, { fields: [magicLinkTokens.clientId], references: [clients.id] }),
}));
```

Then push:
```bash
npx drizzle-kit push
```

---

## Step 2: Create Magic Link Service

**CREATE** `src/lib/services/magic-link.ts`:

```typescript
import { db } from '@/lib/db';
import { magicLinkTokens, clients } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export async function createMagicLink(clientId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await db.insert(magicLinkTokens).values({
    clientId,
    token,
    expiresAt,
  });

  return `${process.env.NEXT_PUBLIC_APP_URL}/d/${token}`;
}

export async function validateMagicLink(token: string): Promise<{
  valid: boolean;
  clientId?: string;
  error?: string;
}> {
  const [record] = await db
    .select()
    .from(magicLinkTokens)
    .where(and(
      eq(magicLinkTokens.token, token),
      gt(magicLinkTokens.expiresAt, new Date())
    ))
    .limit(1);

  if (!record) {
    return { valid: false, error: 'Invalid or expired link' };
  }

  // Mark as used (but don't invalidate - allow reuse within expiry)
  if (!record.usedAt) {
    await db
      .update(magicLinkTokens)
      .set({ usedAt: new Date() })
      .where(eq(magicLinkTokens.id, record.id));
  }

  return { valid: true, clientId: record.clientId! };
}

export async function sendDashboardLink(clientId: string, phone: string, twilioNumber: string): Promise<void> {
  const { sendSMS } = await import('@/lib/services/twilio');
  
  const link = await createMagicLink(clientId);
  
  await sendSMS(
    phone,
    twilioNumber,
    `Here's your dashboard link (valid for 7 days):\n${link}`
  );
}
```

---

## Step 3: Create Dashboard Auth Route

**CREATE** `src/app/d/[token]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateMagicLink } from '@/lib/services/magic-link';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const result = await validateMagicLink(params.token);

  if (!result.valid) {
    return NextResponse.redirect(
      new URL('/link-expired', request.url)
    );
  }

  // Set client session cookie
  const cookieStore = cookies();
  cookieStore.set('clientSessionId', result.clientId!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  return NextResponse.redirect(
    new URL('/client', request.url)
  );
}
```

---

## Step 4: Create Client Auth Helper

**CREATE** `src/lib/client-auth.ts`:

```typescript
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function getClientSession(): Promise<{
  clientId: string;
  client: typeof clients.$inferSelect;
} | null> {
  const cookieStore = cookies();
  const clientId = cookieStore.get('clientSessionId')?.value;

  if (!clientId) {
    return null;
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    return null;
  }

  return { clientId, client };
}
```

---

## Step 5: Create Link Expired Page

**CREATE** `src/app/(auth)/link-expired/page.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LinkExpiredPage() {
  return (
    <Card className="max-w-md mx-auto mt-20 text-center">
      <CardHeader>
        <CardTitle>Link Expired</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          This dashboard link has expired or is invalid.
        </p>
        <p className="text-sm text-muted-foreground">
          Text <strong>DASHBOARD</strong> to your business number to get a new link.
        </p>
      </CardContent>
    </Card>
  );
}
```

---

## Step 6: Create Client Dashboard Layout

**CREATE** `src/app/(client)/layout.tsx`:

```typescript
import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const navItems = [
  { href: '/client', label: 'Dashboard' },
  { href: '/client/conversations', label: 'Conversations' },
  { href: '/client/team', label: 'Team' },
];

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getClientSession();

  if (!session) {
    redirect('/link-expired');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex justify-between items-center h-14">
            <span className="font-semibold text-sm truncate max-w-[200px]">
              {session.client.businessName}
            </span>
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
```

---

## Step 7: Create Client Dashboard Page

**CREATE** `src/app/(client)/client/page.tsx`:

```typescript
import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { leads, conversations, dailyStats, appointments } from '@/lib/db/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

export default async function ClientDashboardPage() {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const { clientId, client } = session;

  // This month stats
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const monthStats = await db
    .select({
      leadsCapture: sql<number>`COALESCE(SUM(${dailyStats.missedCallsCaptured}) + SUM(${dailyStats.formsResponded}), 0)`,
      messagesSent: sql<number>`COALESCE(SUM(${dailyStats.messagesSent}), 0)`,
      appointmentsBooked: sql<number>`COALESCE(SUM(${dailyStats.appointmentsReminded}), 0)`,
    })
    .from(dailyStats)
    .where(and(
      eq(dailyStats.clientId, clientId),
      gte(dailyStats.date, firstOfMonth.toISOString().split('T')[0])
    ));

  const stats = monthStats[0] || {};

  // Recent activity
  const recentLeads = await db
    .select()
    .from(leads)
    .where(eq(leads.clientId, clientId))
    .orderBy(desc(leads.createdAt))
    .limit(5);

  // Pending appointments
  const upcomingAppointments = await db
    .select({
      id: appointments.id,
      date: appointments.appointmentDate,
      time: appointments.appointmentTime,
      leadName: leads.name,
      leadPhone: leads.phone,
    })
    .from(appointments)
    .leftJoin(leads, eq(appointments.leadId, leads.id))
    .where(and(
      eq(appointments.clientId, clientId),
      eq(appointments.status, 'scheduled'),
      gte(appointments.appointmentDate, new Date().toISOString().split('T')[0])
    ))
    .orderBy(appointments.appointmentDate)
    .limit(5);

  return (
    <div className="space-y-6">
      {/* Value Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{Number(stats.leadsCapture) || 0}</div>
            <p className="text-sm text-muted-foreground">Leads This Month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{Number(stats.messagesSent) || 0}</div>
            <p className="text-sm text-muted-foreground">Messages Sent</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Appointments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingAppointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming appointments</p>
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.map((apt) => (
                <div key={apt.id} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{apt.leadName || apt.leadPhone}</p>
                    <p className="text-sm text-muted-foreground">
                      {apt.date} at {apt.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Leads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Leads</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leads yet</p>
          ) : (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{lead.name || lead.phone}</p>
                    <p className="text-sm text-muted-foreground">{lead.source}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(lead.createdAt!), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Step 8: Handle DASHBOARD Text Command

**UPDATE** `src/lib/automations/incoming-sms.ts`:

Add this check near the top of `handleIncomingSMS`, after finding the client:

```typescript
// Handle DASHBOARD request
if (messageBody.toUpperCase() === 'DASHBOARD') {
  const { sendDashboardLink } = await import('@/lib/services/magic-link');
  await sendDashboardLink(client.id, senderPhone, client.twilioNumber!);
  return { processed: true, action: 'dashboard_link_sent' };
}
```

---

## Verify

1. `npm run dev`
2. As admin, note a client's phone number
3. Text "DASHBOARD" to the Twilio number
4. Receive link via SMS
5. Click link → auto-logged in → see dashboard
6. Link works for 7 days

---

## Next
Proceed to **Phase 12b** for CRM conversations view.
