'use client';

import { useState } from 'react';
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

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}
