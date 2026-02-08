# Phase 12c: Weekly SMS Summary

## Current State (after Phase 12b)
- Client dashboard and CRM working
- No automated value reminders
- Clients might forget the system exists

## Goal
Automated weekly SMS + email summary showing value delivered.

---

## Step 1: Add Notification Preferences to Clients

**APPEND** to clients table in `src/lib/db/schema.ts`:

```typescript
weeklySummaryEnabled: boolean('weekly_summary_enabled').default(true),
weeklySummaryDay: integer('weekly_summary_day').default(1), // 0=Sun, 1=Mon
weeklySummaryTime: varchar('weekly_summary_time', { length: 5 }).default('08:00'),
lastWeeklySummaryAt: timestamp('last_weekly_summary_at'),
```

Run: `npx drizzle-kit push`

---

## Step 2: Create Weekly Summary Service

**CREATE** `src/lib/services/weekly-summary.ts`:

```typescript
import { db } from '@/lib/db';
import { clients, leads, dailyStats, conversations } from '@/lib/db/schema';
import { eq, and, gte, sql, between } from 'drizzle-orm';
import { sendSMS } from '@/lib/services/twilio';
import { sendEmail } from '@/lib/services/email';
import { createMagicLink } from '@/lib/services/magic-link';
import { formatPhoneNumber } from '@/lib/utils/phone';

interface WeeklyStats {
  leadsCapture: number;
  messagesSent: number;
  appointmentsBooked: number;
  escalationsClaimed: number;
  topTeamMember: string | null;
  topTeamMemberClaims: number;
}

export async function getWeeklyStats(clientId: string): Promise<WeeklyStats> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [stats] = await db
    .select({
      leadsCapture: sql<number>`COALESCE(SUM(${dailyStats.missedCallsCaptured}) + SUM(${dailyStats.formsResponded}), 0)`,
      messagesSent: sql<number>`COALESCE(SUM(${dailyStats.messagesSent}), 0)`,
      appointmentsBooked: sql<number>`COALESCE(SUM(${dailyStats.appointmentsReminded}), 0)`,
    })
    .from(dailyStats)
    .where(and(
      eq(dailyStats.clientId, clientId),
      gte(dailyStats.date, sevenDaysAgo.toISOString().split('T')[0])
    ));

  // Get escalation claims
  const escalationStats = await db.execute(sql`
    SELECT 
      tm.name as team_member_name,
      COUNT(*) as claims
    FROM escalation_claims ec
    JOIN team_members tm ON ec.claimed_by = tm.id
    WHERE ec.client_id = ${clientId}
      AND ec.claimed_at >= ${sevenDaysAgo}
    GROUP BY tm.id, tm.name
    ORDER BY claims DESC
    LIMIT 1
  `);

  const topMember = escalationStats.rows[0] as any;

  return {
    leadsCapture: Number(stats?.leadsCapture || 0),
    messagesSent: Number(stats?.messagesSent || 0),
    appointmentsBooked: Number(stats?.appointmentsBooked || 0),
    escalationsClaimed: topMember?.claims || 0,
    topTeamMember: topMember?.team_member_name || null,
    topTeamMemberClaims: Number(topMember?.claims || 0),
  };
}

export function formatWeeklySMS(
  businessName: string,
  stats: WeeklyStats,
  dashboardLink: string
): string {
  let message = `📊 ${businessName} Weekly Recap\n\n`;
  message += `✅ ${stats.leadsCapture} leads captured\n`;
  message += `✅ ${stats.messagesSent} messages sent\n`;
  
  if (stats.appointmentsBooked > 0) {
    message += `✅ ${stats.appointmentsBooked} appointments\n`;
  }

  if (stats.topTeamMember) {
    message += `\n🏆 Top: ${stats.topTeamMember} (${stats.topTeamMemberClaims} claims)\n`;
  }

  message += `\nFull stats → ${dashboardLink}`;

  return message;
}

export function formatWeeklyEmail(
  businessName: string,
  ownerName: string,
  stats: WeeklyStats,
  dashboardLink: string
): { subject: string; html: string } {
  const subject = `Your Week with ConversionSurgery - ${stats.leadsCapture} Leads Captured 🎯`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hi ${ownerName},</h2>
      
      <p>Here's what happened at <strong>${businessName}</strong> this week:</p>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">📞 LEADS CAPTURED</h3>
        <p style="font-size: 24px; font-weight: bold; margin: 0;">${stats.leadsCapture}</p>
        
        <h3>💬 MESSAGES SENT</h3>
        <p style="font-size: 24px; font-weight: bold; margin: 0;">${stats.messagesSent}</p>
        
        ${stats.appointmentsBooked > 0 ? `
          <h3>📅 APPOINTMENTS</h3>
          <p style="font-size: 24px; font-weight: bold; margin: 0;">${stats.appointmentsBooked}</p>
        ` : ''}
      </div>
      
      ${stats.topTeamMember ? `
        <p>🏆 <strong>Top performer:</strong> ${stats.topTeamMember} claimed ${stats.topTeamMemberClaims} leads</p>
      ` : ''}
      
      <p>
        <a href="${dashboardLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          View Full Dashboard →
        </a>
      </p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
      
      <p style="color: #666; font-size: 14px;">
        Questions? Reply to this email or text us anytime.
      </p>
    </div>
  `;

  return { subject, html };
}

export async function sendWeeklySummary(clientId: string): Promise<void> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client || !client.weeklySummaryEnabled) return;

  const stats = await getWeeklyStats(clientId);
  const dashboardLink = await createMagicLink(clientId);

  // Send SMS
  if (client.phone && client.twilioNumber) {
    const smsContent = formatWeeklySMS(client.businessName, stats, dashboardLink);
    await sendSMS(client.phone, client.twilioNumber, smsContent);
  }

  // Send Email
  if (client.email) {
    const emailContent = formatWeeklyEmail(
      client.businessName,
      client.ownerName,
      stats,
      dashboardLink
    );
    await sendEmail(client.email, emailContent.subject, emailContent.html);
  }

  // Update last sent
  await db
    .update(clients)
    .set({ lastWeeklySummaryAt: new Date() })
    .where(eq(clients.id, clientId));
}

export async function processWeeklySummaries(): Promise<number> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentHour = now.getHours();
  const currentTime = `${currentHour.toString().padStart(2, '0')}:00`;

  // Find clients who should receive summary now
  const eligibleClients = await db
    .select()
    .from(clients)
    .where(and(
      eq(clients.status, 'active'),
      eq(clients.weeklySummaryEnabled, true),
      eq(clients.weeklySummaryDay, dayOfWeek)
    ));

  let sent = 0;
  for (const client of eligibleClients) {
    const summaryTime = client.weeklySummaryTime || '08:00';
    const summaryHour = parseInt(summaryTime.split(':')[0]);

    // Check if it's the right hour
    if (summaryHour !== currentHour) continue;

    // Check if already sent this week
    if (client.lastWeeklySummaryAt) {
      const lastSent = new Date(client.lastWeeklySummaryAt);
      const daysSince = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 6) continue;
    }

    try {
      await sendWeeklySummary(client.id);
      sent++;
    } catch (error) {
      console.error(`Failed to send summary to ${client.id}:`, error);
    }
  }

  return sent;
}
```

---

## Step 3: Create Weekly Summary Cron Route

**CREATE** `src/app/api/cron/weekly-summary/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { processWeeklySummaries } from '@/lib/services/weekly-summary';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sent = await processWeeklySummaries();
    return NextResponse.json({ success: true, sent });
  } catch (error) {
    console.error('Weekly summary error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

---

## Step 4: Add Cron Job Config

**UPDATE** `vercel.json` (or Coolify cron config):

```json
{
  "crons": [
    {
      "path": "/api/cron/sequences",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/weekly-summary",
      "schedule": "0 * * * *"
    }
  ]
}
```

Weekly summary runs hourly, checks if any clients need their summary at that hour.

---

## Step 5: Add Summary Preferences to Client Settings

**CREATE** `src/app/(client)/client/settings/page.tsx`:

```typescript
import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SummarySettings } from './summary-settings';

export default async function ClientSettingsPage() {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <SummarySettings
            enabled={session.client.weeklySummaryEnabled ?? true}
            day={session.client.weeklySummaryDay ?? 1}
            time={session.client.weeklySummaryTime ?? '08:00'}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

**CREATE** `src/app/(client)/client/settings/summary-settings.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIMES = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00'];

interface Props {
  enabled: boolean;
  day: number;
  time: string;
}

export function SummarySettings({ enabled, day, time }: Props) {
  const router = useRouter();
  const [settings, setSettings] = useState({ enabled, day, time });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    await fetch('/api/client/settings/summary', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });

    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Receive weekly summary</Label>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
        />
      </div>

      {settings.enabled && (
        <>
          <div className="space-y-2">
            <Label>Day of week</Label>
            <Select
              value={settings.day.toString()}
              onValueChange={(v) => setSettings({ ...settings, day: parseInt(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Time</Label>
            <Select
              value={settings.time}
              onValueChange={(v) => setSettings({ ...settings, time: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
      </Button>
    </div>
  );
}
```

---

## Step 6: Create Settings API Route

**CREATE** `src/app/api/client/settings/summary/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(request: NextRequest) {
  const cookieStore = cookies();
  const clientId = cookieStore.get('clientSessionId')?.value;

  if (!clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { enabled, day, time } = await request.json();

  await db
    .update(clients)
    .set({
      weeklySummaryEnabled: enabled,
      weeklySummaryDay: day,
      weeklySummaryTime: time,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, clientId));

  return NextResponse.json({ success: true });
}
```

---

## Step 7: Update Client Layout with Settings Link

**UPDATE** `src/app/(client)/layout.tsx` nav items:

```typescript
const navItems = [
  { href: '/client', label: 'Dashboard' },
  { href: '/client/conversations', label: 'Conversations' },
  { href: '/client/team', label: 'Team' },
  { href: '/client/settings', label: 'Settings' },
];
```

---

## Verify

1. `npm run dev`
2. Access client dashboard
3. Go to Settings → configure summary preferences
4. Manually test: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/weekly-summary`
5. Client receives SMS + email with stats

---

## Next
Proceed to **Phase 14a** for custom flow system.
