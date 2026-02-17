'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Props {
  defaults: {
    missedCallSmsEnabled: boolean;
    aiResponseEnabled: boolean;
    photoRequestsEnabled: boolean;
    notificationEmail: boolean;
    notificationSms: boolean;
  };
}

const TOGGLE_LABELS: Record<string, { label: string; description: string }> = {
  missedCallSmsEnabled: {
    label: 'Missed Call SMS',
    description: 'Automatically text back when you miss a call',
  },
  aiResponseEnabled: {
    label: 'AI Responses',
    description: 'Let AI respond to incoming messages',
  },
  photoRequestsEnabled: {
    label: 'Photo Requests',
    description: 'AI can ask leads to send photos of their project',
  },
  notificationEmail: {
    label: 'Email Notifications',
    description: 'Receive email alerts for new leads and messages',
  },
  notificationSms: {
    label: 'SMS Notifications',
    description: 'Receive text alerts for new leads and messages',
  },
};

export function FeatureTogglesForm({ defaults }: Props) {
  const [form, setForm] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (key: string) => {
    setForm((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch('/api/client/features', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
  };

  return (
    <div className="space-y-4">
      {Object.entries(TOGGLE_LABELS).map(([key, meta]) => (
        <Card key={key}>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium">{meta.label}</p>
              <p className="text-sm text-muted-foreground">{meta.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form[key as keyof typeof form]}
              onClick={() => toggle(key)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                form[key as keyof typeof form] ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                  form[key as keyof typeof form] ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-[#3D7A50]">Saved</span>}
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
