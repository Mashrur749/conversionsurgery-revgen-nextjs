'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
import { AI_ASSIST_CATEGORIES } from '@/lib/services/ai-send-policy';
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes-warning';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface Props {
  defaults: {
    missedCallSmsEnabled: boolean;
    aiResponseEnabled: boolean;
    smartAssistEnabled: boolean;
    smartAssistDelayMinutes: number;
    smartAssistManualCategories: string[];
    photoRequestsEnabled: boolean;
    notificationEmail: boolean;
    notificationSms: boolean;
  };
}

const SMART_ASSIST_CATEGORY_LABELS: Record<string, string> = {
  first_response: 'First response',
  follow_up: 'Follow-up',
  estimate_followup: 'Estimate follow-up',
  payment: 'Payment reminders',
  appointment: 'Appointment messages',
  review: 'Review requests',
  general: 'General outbound AI',
};

const TOGGLE_LABELS: Record<string, { label: string; description: string; tooltip?: string }> = {
  missedCallSmsEnabled: {
    label: 'Missed Call SMS',
    description: 'Automatically text back when you miss a call',
  },
  aiResponseEnabled: {
    label: 'AI Responses',
    description: 'Let AI respond to incoming messages',
  },
  smartAssistEnabled: {
    label: 'Smart Assist Auto-Send',
    description: 'AI drafts auto-send after your review window',
    tooltip: 'AI drafts responses for your review before sending. Auto-sends after the delay if you don\u0027t act.',
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
  const [savedForm, setSavedForm] = useState(defaults);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm]
  );
  useUnsavedChangesWarning(isDirty);

  const toggle = (
    key: 'missedCallSmsEnabled' | 'aiResponseEnabled' | 'smartAssistEnabled' | 'photoRequestsEnabled' | 'notificationEmail' | 'notificationSms'
  ) => {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const toggleManualCategory = (category: string) => {
    setForm((prev) => {
      const exists = prev.smartAssistManualCategories.includes(category);
      return {
        ...prev,
        smartAssistManualCategories: exists
          ? prev.smartAssistManualCategories.filter((item) => item !== category)
          : [...prev.smartAssistManualCategories, category],
      };
    });
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
    if (res.ok) {
      setSaved(true);
      setSavedForm(form);
    }
  };

  return (
    <div className="space-y-4">
      {Object.entries(TOGGLE_LABELS).map(([key, meta]) => (
        <Card key={key}>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-medium">{meta.label}</p>
                {meta.tooltip && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{meta.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{meta.description}</p>
            </div>
            <Switch
              id={key}
              checked={Boolean(form[key as keyof typeof form])}
              onCheckedChange={() => toggle(key as 'missedCallSmsEnabled' | 'aiResponseEnabled' | 'smartAssistEnabled' | 'photoRequestsEnabled' | 'notificationEmail' | 'notificationSms')}
              aria-label={meta.label}
            />
          </CardContent>
        </Card>
      ))}

      {form.smartAssistEnabled && (
        <Card>
          <CardContent className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <Label>Auto-send delay</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>How long to wait for your review before the AI sends automatically.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-sm text-muted-foreground">
                  Time before untouched AI drafts send automatically
                </p>
              </div>
              <Select
                value={String(form.smartAssistDelayMinutes)}
                onValueChange={(value) => {
                  setForm((prev) => ({ ...prev, smartAssistDelayMinutes: Number(value) }));
                  setSaved(false);
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 minute</SelectItem>
                  <SelectItem value="3">3 minutes</SelectItem>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Manual-only categories</Label>
              <p className="text-sm text-muted-foreground">
                Sensitive categories require explicit approval before sending.
              </p>
              <div className="space-y-2">
                {AI_ASSIST_CATEGORIES.map((category) => (
                  <div key={category} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {SMART_ASSIST_CATEGORY_LABELS[category] || category}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Manual approval required
                      </p>
                    </div>
                    <Switch
                      id={`manual-${category}`}
                      checked={form.smartAssistManualCategories.includes(category)}
                      onCheckedChange={() => toggleManualCategory(category)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-[#3D7A50]">Saved</span>}
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
