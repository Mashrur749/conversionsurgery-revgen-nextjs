# Phase 16a: Notification Preferences

## Current State (after Phase 15)
- Clients receive weekly summaries
- No granular control over notifications
- Can't customize what alerts they get

## Goal
Let clients configure exactly what notifications they receive.

---

## Step 1: Add Notification Preferences to Schema

**APPEND** to `src/lib/db/schema.ts`:

```typescript
// ============================================
// NOTIFICATION PREFERENCES
// ============================================
export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).unique(),
  
  // SMS Notifications
  smsNewLead: boolean('sms_new_lead').default(true),
  smsEscalation: boolean('sms_escalation').default(true),
  smsWeeklySummary: boolean('sms_weekly_summary').default(true),
  smsFlowApproval: boolean('sms_flow_approval').default(true),
  smsNegativeReview: boolean('sms_negative_review').default(true),
  
  // Email Notifications  
  emailNewLead: boolean('email_new_lead').default(false),
  emailDailySummary: boolean('email_daily_summary').default(false),
  emailWeeklySummary: boolean('email_weekly_summary').default(true),
  emailMonthlyReport: boolean('email_monthly_report').default(true),
  
  // Quiet Hours
  quietHoursEnabled: boolean('quiet_hours_enabled').default(false),
  quietHoursStart: varchar('quiet_hours_start', { length: 5 }).default('22:00'),
  quietHoursEnd: varchar('quiet_hours_end', { length: 5 }).default('07:00'),
  
  // Urgency Override (always notify for urgent even in quiet hours)
  urgentOverride: boolean('urgent_override').default(true),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  client: one(clients, { fields: [notificationPreferences.clientId], references: [clients.id] }),
}));
```

Run: `npx drizzle-kit push`

---

## Step 2: Create Notification Preferences Service

**CREATE** `src/lib/services/notification-preferences.ts`:

```typescript
import { db } from '@/lib/db';
import { notificationPreferences, clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface NotificationPrefs {
  smsNewLead: boolean;
  smsEscalation: boolean;
  smsWeeklySummary: boolean;
  smsFlowApproval: boolean;
  smsNegativeReview: boolean;
  emailNewLead: boolean;
  emailDailySummary: boolean;
  emailWeeklySummary: boolean;
  emailMonthlyReport: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  urgentOverride: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  smsNewLead: true,
  smsEscalation: true,
  smsWeeklySummary: true,
  smsFlowApproval: true,
  smsNegativeReview: true,
  emailNewLead: false,
  emailDailySummary: false,
  emailWeeklySummary: true,
  emailMonthlyReport: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  urgentOverride: true,
};

export async function getNotificationPrefs(clientId: string): Promise<NotificationPrefs> {
  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.clientId, clientId))
    .limit(1);

  if (!prefs) {
    // Create default prefs
    await db.insert(notificationPreferences).values({
      clientId,
      ...DEFAULT_PREFS,
    });
    return DEFAULT_PREFS;
  }

  return {
    smsNewLead: prefs.smsNewLead ?? true,
    smsEscalation: prefs.smsEscalation ?? true,
    smsWeeklySummary: prefs.smsWeeklySummary ?? true,
    smsFlowApproval: prefs.smsFlowApproval ?? true,
    smsNegativeReview: prefs.smsNegativeReview ?? true,
    emailNewLead: prefs.emailNewLead ?? false,
    emailDailySummary: prefs.emailDailySummary ?? false,
    emailWeeklySummary: prefs.emailWeeklySummary ?? true,
    emailMonthlyReport: prefs.emailMonthlyReport ?? true,
    quietHoursEnabled: prefs.quietHoursEnabled ?? false,
    quietHoursStart: prefs.quietHoursStart ?? '22:00',
    quietHoursEnd: prefs.quietHoursEnd ?? '07:00',
    urgentOverride: prefs.urgentOverride ?? true,
  };
}

export async function updateNotificationPrefs(
  clientId: string,
  updates: Partial<NotificationPrefs>
): Promise<void> {
  const existing = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.clientId, clientId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(notificationPreferences).values({
      clientId,
      ...DEFAULT_PREFS,
      ...updates,
    });
  } else {
    await db
      .update(notificationPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(notificationPreferences.clientId, clientId));
  }
}

export function isInQuietHours(prefs: NotificationPrefs): boolean {
  if (!prefs.quietHoursEnabled) return false;

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const start = prefs.quietHoursStart;
  const end = prefs.quietHoursEnd;

  // Handle overnight quiet hours (e.g., 22:00 to 07:00)
  if (start > end) {
    return currentTime >= start || currentTime < end;
  }
  
  return currentTime >= start && currentTime < end;
}

export async function shouldNotify(
  clientId: string,
  type: keyof NotificationPrefs,
  isUrgent: boolean = false
): Promise<boolean> {
  const prefs = await getNotificationPrefs(clientId);

  // Check if notification type is enabled
  if (!prefs[type]) return false;

  // Check quiet hours
  if (isInQuietHours(prefs)) {
    // Allow urgent notifications if override enabled
    if (isUrgent && prefs.urgentOverride) return true;
    return false;
  }

  return true;
}
```

---

## Step 3: Create Notification Preferences API

**CREATE** `src/app/api/client/notifications/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getNotificationPrefs, updateNotificationPrefs } from '@/lib/services/notification-preferences';

export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const clientId = cookieStore.get('clientSessionId')?.value;

  if (!clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prefs = await getNotificationPrefs(clientId);
  return NextResponse.json({ prefs });
}

export async function PUT(request: NextRequest) {
  const cookieStore = cookies();
  const clientId = cookieStore.get('clientSessionId')?.value;

  if (!clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const updates = await request.json();
  await updateNotificationPrefs(clientId, updates);

  return NextResponse.json({ success: true });
}
```

---

## Step 4: Create Notification Settings Page

**CREATE** `src/app/(client)/client/settings/notifications/page.tsx`:

```typescript
import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getNotificationPrefs } from '@/lib/services/notification-preferences';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { NotificationSettingsForm } from './notification-settings-form';

export default async function NotificationSettingsPage() {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const prefs = await getNotificationPrefs(session.clientId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Notification Settings</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/client/settings">← Back</Link>
        </Button>
      </div>

      <NotificationSettingsForm initialPrefs={prefs} />
    </div>
  );
}
```

---

## Step 5: Create Notification Settings Form

**CREATE** `src/app/(client)/client/settings/notifications/notification-settings-form.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface NotificationPrefs {
  smsNewLead: boolean;
  smsEscalation: boolean;
  smsWeeklySummary: boolean;
  smsFlowApproval: boolean;
  smsNegativeReview: boolean;
  emailNewLead: boolean;
  emailDailySummary: boolean;
  emailWeeklySummary: boolean;
  emailMonthlyReport: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  urgentOverride: boolean;
}

interface Props {
  initialPrefs: NotificationPrefs;
}

export function NotificationSettingsForm({ initialPrefs }: Props) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(initialPrefs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    await fetch('/api/client/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function toggle(key: keyof NotificationPrefs) {
    setPrefs({ ...prefs, [key]: !prefs[key] });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SMS Notifications</CardTitle>
          <CardDescription>Text messages sent to your phone</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>New lead alerts</Label>
            <Switch checked={prefs.smsNewLead} onCheckedChange={() => toggle('smsNewLead')} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Team escalations</Label>
            <Switch checked={prefs.smsEscalation} onCheckedChange={() => toggle('smsEscalation')} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Weekly summary</Label>
            <Switch checked={prefs.smsWeeklySummary} onCheckedChange={() => toggle('smsWeeklySummary')} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Flow approval requests</Label>
            <Switch checked={prefs.smsFlowApproval} onCheckedChange={() => toggle('smsFlowApproval')} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Negative review alerts</Label>
            <Switch checked={prefs.smsNegativeReview} onCheckedChange={() => toggle('smsNegativeReview')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>Emails sent to your inbox</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>New lead alerts</Label>
            <Switch checked={prefs.emailNewLead} onCheckedChange={() => toggle('emailNewLead')} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Daily summary</Label>
            <Switch checked={prefs.emailDailySummary} onCheckedChange={() => toggle('emailDailySummary')} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Weekly summary</Label>
            <Switch checked={prefs.emailWeeklySummary} onCheckedChange={() => toggle('emailWeeklySummary')} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Monthly report</Label>
            <Switch checked={prefs.emailMonthlyReport} onCheckedChange={() => toggle('emailMonthlyReport')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quiet Hours</CardTitle>
          <CardDescription>Pause non-urgent notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Enable quiet hours</Label>
            <Switch checked={prefs.quietHoursEnabled} onCheckedChange={() => toggle('quietHoursEnabled')} />
          </div>

          {prefs.quietHoursEnabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Start</Label>
                  <Input
                    type="time"
                    value={prefs.quietHoursStart}
                    onChange={(e) => setPrefs({ ...prefs, quietHoursStart: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">End</Label>
                  <Input
                    type="time"
                    value={prefs.quietHoursEnd}
                    onChange={(e) => setPrefs({ ...prefs, quietHoursEnd: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow urgent notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Still receive negative reviews and escalations
                  </p>
                </div>
                <Switch checked={prefs.urgentOverride} onCheckedChange={() => toggle('urgentOverride')} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Preferences'}
      </Button>
    </div>
  );
}
```

---

## Step 6: Add Link to Main Settings Page

**UPDATE** `src/app/(client)/client/settings/page.tsx`:

Add link to notification settings:

```typescript
<Card>
  <CardHeader>
    <CardTitle>Notifications</CardTitle>
  </CardHeader>
  <CardContent>
    <Button asChild variant="outline">
      <Link href="/client/settings/notifications">
        Manage Notifications →
      </Link>
    </Button>
  </CardContent>
</Card>
```

---

## Verify

1. `npm run dev`
2. Access client dashboard
3. Go to Settings → Manage Notifications
4. Toggle various notification types
5. Configure quiet hours
6. Save and verify preferences persist

---

## Next
Proceed to **Phase 16b** for cancellation flow.
