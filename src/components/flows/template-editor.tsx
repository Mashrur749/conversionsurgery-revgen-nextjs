'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SequenceView } from './sequence-view';
import { Save, Upload, ArrowLeft, Plus } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface TemplateStep {
  id?: string;
  stepNumber: number;
  name: string;
  delayMinutes: number;
  messageTemplate: string;
  skipConditions?: {
    ifReplied?: boolean;
    ifScheduled?: boolean;
    ifPaid?: boolean;
  };
}

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  version: number | null;
  isPublished: boolean | null;
  defaultTrigger: string | null;
  defaultApprovalMode: string | null;
  tags: unknown;
}

interface TemplateEditorProps {
  template: Template | null;
  steps: TemplateStep[];
  isNew: boolean;
}

const CATEGORIES = [
  { value: 'estimate', label: 'Estimate Follow-up' },
  { value: 'payment', label: 'Payment Reminder' },
  { value: 'review', label: 'Review Request' },
  { value: 'referral', label: 'Referral Request' },
  { value: 'appointment', label: 'Appointment Reminder' },
  { value: 'missed_call', label: 'Missed Call' },
  { value: 'form_response', label: 'Form Response' },
  { value: 'custom', label: 'Custom' },
];

const TRIGGERS = [
  { value: 'manual', label: 'Manual (button click)' },
  { value: 'ai_suggested', label: 'AI Suggested' },
  { value: 'webhook', label: 'Automatic (webhook)' },
  { value: 'scheduled', label: 'Scheduled' },
];

const APPROVAL_MODES = [
  { value: 'auto', label: 'Auto-execute' },
  { value: 'suggest', label: 'Show in CRM' },
  { value: 'ask_sms', label: 'Ask via SMS' },
];

export function TemplateEditor({ template, steps, isNew }: TemplateEditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const templateTags = Array.isArray(template?.tags)
    ? (template.tags as string[]).join(', ')
    : '';

  const [form, setForm] = useState({
    name: template?.name || '',
    slug: template?.slug || '',
    description: template?.description || '',
    category: template?.category || 'custom',
    defaultTrigger: template?.defaultTrigger || 'manual',
    defaultApprovalMode: template?.defaultApprovalMode || 'auto',
    tags: templateTags,
  });

  const [localSteps, setLocalSteps] = useState<TemplateStep[]>(
    steps.length > 0
      ? steps
      : [{ stepNumber: 1, name: 'Step 1', delayMinutes: 0, messageTemplate: '' }]
  );

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: isNew ? generateSlug(name) : prev.slug,
    }));
  };

  const addStep = () => {
    setLocalSteps((prev) => [
      ...prev,
      {
        stepNumber: prev.length + 1,
        name: `Step ${prev.length + 1}`,
        delayMinutes: 24 * 60,
        messageTemplate: '',
      },
    ]);
  };

  const updateStep = (index: number, updates: Partial<TemplateStep>) => {
    setLocalSteps((prev) => {
      const newSteps = [...prev];
      newSteps[index] = { ...newSteps[index], ...updates };
      return newSteps;
    });
  };

  const deleteStep = (index: number) => {
    setLocalSteps((prev) => {
      const newSteps = prev.filter((_, i) => i !== index);
      return newSteps.map((s, i) => ({ ...s, stepNumber: i + 1 }));
    });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === localSteps.length - 1)
    )
      return;

    setLocalSteps((prev) => {
      const newSteps = [...prev];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      [newSteps[index], newSteps[swapIndex]] = [newSteps[swapIndex], newSteps[index]];
      return newSteps.map((s, i) => ({ ...s, stepNumber: i + 1 }));
    });
  };

  const save = async () => {
    if (!form.name || !form.slug || !form.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (localSteps.some((s) => !s.messageTemplate)) {
      toast.error('All steps must have a message');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        steps: localSteps,
      };

      const url = isNew
        ? '/api/admin/flow-templates'
        : `/api/admin/flow-templates/${template?.id}`;

      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save');

      const data = (await res.json()) as { id: string };
      toast.success('Template saved!');

      if (isNew) {
        router.push(`/admin/flow-templates/${data.id}`);
      } else {
        router.refresh();
      }
    } catch {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (isNew) {
      toast.error('Save template first');
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch(`/api/admin/flow-templates/${template?.id}/publish`, {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to publish');

      toast.success('Template published!');
      router.refresh();
    } catch {
      toast.error('Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/flow-templates">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isNew ? 'New Template' : `Edit: ${template?.name}`}
            </h1>
            {!isNew && (
              <p className="text-sm text-muted-foreground">
                Version {template?.version ?? 1} &bull;{' '}
                {template?.isPublished ? 'Published' : 'Draft'}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={save} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          {!isNew && (
            <Button onClick={publish} disabled={publishing}>
              <Upload className="h-4 w-4 mr-2" />
              {publishing ? 'Publishing...' : 'Publish'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Template Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Estimate Follow-up - Standard"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="estimate-standard"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="What does this flow do?"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default Trigger</Label>
                <Select
                  value={form.defaultTrigger}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, defaultTrigger: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Default Approval Mode</Label>
              <Select
                value={form.defaultApprovalMode}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, defaultApprovalMode: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPROVAL_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={form.tags}
                onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                placeholder="estimate, sales, urgent"
              />
            </div>
          </CardContent>
        </Card>

        {/* Sequence View */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Sequence Steps</CardTitle>
            <Button variant="outline" size="sm" onClick={addStep}>
              <Plus className="h-4 w-4 mr-1" />
              Add Step
            </Button>
          </CardHeader>
          <CardContent>
            <SequenceView
              steps={localSteps}
              onUpdateStep={updateStep}
              onDeleteStep={deleteStep}
              onMoveStep={moveStep}
              isTemplate={true}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
