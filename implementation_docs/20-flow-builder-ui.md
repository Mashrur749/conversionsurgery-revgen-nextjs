# Phase 14b: Flow Builder UI with Templates

## Prerequisites
- Phase 14a (Flow Schema with Templates) complete
- Templates seeded in database

## Goal
Admin UI for managing flow templates and client flows with:
1. **Template Library** - Browse, create, edit templates
2. **Sequence View** - Linear step visualization with inheritance
3. **Batch Updates** - Push template changes to clients
4. **Client Flow Setup** - Create from template or custom

---

## Step 1: Template Library Page

**CREATE** `src/app/admin/templates/page.tsx`:

```typescript
import { Suspense } from 'react';
import { db } from '@/lib/db';
import { flowTemplates } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { TemplateList } from '@/components/flows/template-list';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default async function TemplatesPage() {
  const templates = await db
    .select()
    .from(flowTemplates)
    .orderBy(desc(flowTemplates.updatedAt));

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flow Templates</h1>
          <p className="text-muted-foreground">
            Manage reusable flow sequences for clients
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/templates/new">
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Link>
        </Button>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <TemplateList templates={templates} />
      </Suspense>
    </div>
  );
}
```

---

## Step 2: Template List Component

**CREATE** `src/components/flows/template-list.tsx`:

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreVertical, 
  Edit, 
  Copy, 
  Trash2, 
  Users, 
  Upload,
  FileText,
  DollarSign,
  Star,
  Calendar,
  Phone,
  MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  version: number;
  isPublished: boolean;
  usageCount: number | null;
  tags: string[] | null;
  updatedAt: Date | null;
}

interface TemplateListProps {
  templates: Template[];
}

const categoryIcons: Record<string, any> = {
  estimate: FileText,
  payment: DollarSign,
  review: Star,
  referral: Users,
  appointment: Calendar,
  missed_call: Phone,
  form_response: MessageSquare,
  custom: FileText,
};

const categoryColors: Record<string, string> = {
  estimate: 'bg-blue-100 text-blue-800',
  payment: 'bg-green-100 text-green-800',
  review: 'bg-yellow-100 text-yellow-800',
  referral: 'bg-purple-100 text-purple-800',
  appointment: 'bg-orange-100 text-orange-800',
  missed_call: 'bg-red-100 text-red-800',
  form_response: 'bg-cyan-100 text-cyan-800',
  custom: 'bg-gray-100 text-gray-800',
};

export function TemplateList({ templates }: TemplateListProps) {
  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No templates yet</p>
          <Button asChild className="mt-4">
            <Link href="/admin/templates/new">Create First Template</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Group by category
  const grouped = templates.reduce((acc, template) => {
    const cat = template.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([category, categoryTemplates]) => {
        const Icon = categoryIcons[category] || FileText;
        
        return (
          <div key={category}>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 capitalize">
              <Icon className="h-5 w-5" />
              {category.replace('_', ' ')}
            </h2>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categoryTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {template.description || 'No description'}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/templates/${template.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/templates/${template.id}/push`}>
                              <Upload className="h-4 w-4 mr-2" />
                              Push Update
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{template.version}</Badge>
                        {template.isPublished ? (
                          <Badge className="bg-green-100 text-green-800">Published</Badge>
                        ) : (
                          <Badge variant="secondary">Draft</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{template.usageCount || 0} clients</span>
                      </div>
                    </div>
                    
                    {template.tags && template.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {template.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    <p className="text-xs text-muted-foreground mt-3">
                      Updated {formatDistanceToNow(template.updatedAt || new Date(), { addSuffix: true })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

---

## Step 3: Template Editor Page

**CREATE** `src/app/admin/templates/[id]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { flowTemplates, flowTemplateSteps } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TemplateEditor } from '@/components/flows/template-editor';

interface PageProps {
  params: { id: string };
}

export default async function TemplateEditorPage({ params }: PageProps) {
  const isNew = params.id === 'new';
  
  let template = null;
  let steps: any[] = [];
  
  if (!isNew) {
    [template] = await db
      .select()
      .from(flowTemplates)
      .where(eq(flowTemplates.id, params.id))
      .limit(1);
    
    if (!template) notFound();
    
    steps = await db
      .select()
      .from(flowTemplateSteps)
      .where(eq(flowTemplateSteps.templateId, params.id))
      .orderBy(flowTemplateSteps.stepNumber);
  }

  return (
    <div className="container py-6">
      <TemplateEditor 
        template={template} 
        steps={steps}
        isNew={isNew}
      />
    </div>
  );
}
```

---

## Step 4: Template Editor Component

**CREATE** `src/components/flows/template-editor.tsx`:

```typescript
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
import { 
  Save, 
  Upload, 
  ArrowLeft,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface TemplateStep {
  id?: string;
  stepNumber: number;
  name: string;
  delayMinutes: number;
  messageTemplate: string;
  skipConditions?: object;
}

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  version: number;
  isPublished: boolean;
  defaultTrigger: string;
  defaultApprovalMode: string;
  tags: string[] | null;
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
  
  const [form, setForm] = useState({
    name: template?.name || '',
    slug: template?.slug || '',
    description: template?.description || '',
    category: template?.category || 'custom',
    defaultTrigger: template?.defaultTrigger || 'manual',
    defaultApprovalMode: template?.defaultApprovalMode || 'auto',
    tags: template?.tags?.join(', ') || '',
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
    setForm(prev => ({
      ...prev,
      name,
      slug: isNew ? generateSlug(name) : prev.slug,
    }));
  };

  const addStep = () => {
    setLocalSteps(prev => [
      ...prev,
      {
        stepNumber: prev.length + 1,
        name: `Step ${prev.length + 1}`,
        delayMinutes: 24 * 60, // 1 day default
        messageTemplate: '',
      },
    ]);
  };

  const updateStep = (index: number, updates: Partial<TemplateStep>) => {
    setLocalSteps(prev => {
      const newSteps = [...prev];
      newSteps[index] = { ...newSteps[index], ...updates };
      return newSteps;
    });
  };

  const deleteStep = (index: number) => {
    setLocalSteps(prev => {
      const newSteps = prev.filter((_, i) => i !== index);
      // Renumber
      return newSteps.map((s, i) => ({ ...s, stepNumber: i + 1 }));
    });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === localSteps.length - 1)
    ) return;

    setLocalSteps(prev => {
      const newSteps = [...prev];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      [newSteps[index], newSteps[swapIndex]] = [newSteps[swapIndex], newSteps[index]];
      // Renumber
      return newSteps.map((s, i) => ({ ...s, stepNumber: i + 1 }));
    });
  };

  const save = async () => {
    if (!form.name || !form.slug || !form.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (localSteps.some(s => !s.messageTemplate)) {
      toast.error('All steps must have a message');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        steps: localSteps,
      };

      const url = isNew
        ? '/api/admin/templates'
        : `/api/admin/templates/${template?.id}`;
      
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save');

      const data = await res.json();
      toast.success('Template saved!');
      
      if (isNew) {
        router.push(`/admin/templates/${data.id}`);
      }
    } catch (err) {
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
      const res = await fetch(`/api/admin/templates/${template?.id}/publish`, {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to publish');

      toast.success('Template published!');
      router.refresh();
    } catch (err) {
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
            <Link href="/admin/templates">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isNew ? 'New Template' : `Edit: ${template?.name}`}
            </h1>
            {!isNew && (
              <p className="text-sm text-muted-foreground">
                Version {template?.version} • {template?.isPublished ? 'Published' : 'Draft'}
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
                onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="estimate-standard"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="What does this flow do?"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm(prev => ({ ...prev, category: v }))}
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
                  onValueChange={(v) => setForm(prev => ({ ...prev, defaultTrigger: v }))}
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
                onValueChange={(v) => setForm(prev => ({ ...prev, defaultApprovalMode: v }))}
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
                onChange={(e) => setForm(prev => ({ ...prev, tags: e.target.value }))}
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
```

---

## Step 5: Sequence View Component

**CREATE** `src/components/flows/sequence-view.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  ArrowUp,
  ArrowDown,
  Clock,
  MessageSquare,
  Link as LinkIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id?: string;
  stepNumber: number;
  name: string;
  delayMinutes: number;
  messageTemplate?: string;
  customMessage?: string;
  useTemplateMessage?: boolean;
  useTemplateDelay?: boolean;
  customDelayMinutes?: number;
  skipConditions?: {
    ifReplied?: boolean;
    ifScheduled?: boolean;
    ifPaid?: boolean;
  };
  source?: 'template' | 'custom' | 'mixed';
}

interface SequenceViewProps {
  steps: Step[];
  onUpdateStep: (index: number, updates: Partial<Step>) => void;
  onDeleteStep: (index: number) => void;
  onMoveStep: (index: number, direction: 'up' | 'down') => void;
  isTemplate?: boolean;
  templateSteps?: Step[]; // For client flows with template
}

function formatDelay(minutes: number): string {
  if (minutes === 0) return 'Immediately';
  if (minutes < 0) return `${Math.abs(minutes / 60)} hours before`;
  
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return days === 1 ? '1 day' : `${days} days`;
  if (hours > 0) return hours === 1 ? '1 hour' : `${hours} hours`;
  return `${minutes} minutes`;
}

function delayToInput(minutes: number): { value: number; unit: string } {
  if (minutes === 0) return { value: 0, unit: 'minutes' };
  if (minutes % (24 * 60) === 0) return { value: minutes / (24 * 60), unit: 'days' };
  if (minutes % 60 === 0) return { value: minutes / 60, unit: 'hours' };
  return { value: minutes, unit: 'minutes' };
}

function inputToDelay(value: number, unit: string): number {
  switch (unit) {
    case 'days': return value * 24 * 60;
    case 'hours': return value * 60;
    default: return value;
  }
}

export function SequenceView({
  steps,
  onUpdateStep,
  onDeleteStep,
  onMoveStep,
  isTemplate = false,
  templateSteps,
}: SequenceViewProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(0);

  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const isExpanded = expandedStep === index;
        const templateStep = templateSteps?.find(t => t.stepNumber === step.stepNumber);
        const delay = delayToInput(
          step.useTemplateDelay && templateStep
            ? templateStep.delayMinutes
            : step.customDelayMinutes ?? step.delayMinutes
        );

        return (
          <div key={step.id || index} className="relative">
            {/* Connection line */}
            {index > 0 && (
              <div className="absolute left-6 -top-2 w-0.5 h-4 bg-border" />
            )}
            
            <Collapsible open={isExpanded} onOpenChange={() => setExpandedStep(isExpanded ? null : index)}>
              <Card className={cn(
                'transition-all',
                isExpanded && 'ring-2 ring-primary',
                step.source === 'template' && 'border-blue-200 bg-blue-50/50',
                step.source === 'mixed' && 'border-yellow-200 bg-yellow-50/50',
              )}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50">
                    {/* Step number */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                      {step.stepNumber}
                    </div>
                    
                    {/* Step info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {step.name || `Step ${step.stepNumber}`}
                        </span>
                        {step.source === 'template' && (
                          <LinkIcon className="h-3 w-3 text-blue-500" title="From template" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatDelay(delay.value * (delay.unit === 'days' ? 24 * 60 : delay.unit === 'hours' ? 60 : 1))}</span>
                      </div>
                    </div>
                    
                    {/* Expand indicator */}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {/* Step name */}
                    <div className="space-y-2">
                      <Label>Step Name</Label>
                      <Input
                        value={step.name}
                        onChange={(e) => onUpdateStep(index, { name: e.target.value })}
                        placeholder="e.g., Initial follow-up"
                      />
                    </div>

                    {/* Delay */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Delay</Label>
                        {!isTemplate && templateStep && (
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`template-delay-${index}`} className="text-xs text-muted-foreground">
                              Use template
                            </Label>
                            <Switch
                              id={`template-delay-${index}`}
                              checked={step.useTemplateDelay}
                              onCheckedChange={(checked) => onUpdateStep(index, { useTemplateDelay: checked })}
                            />
                          </div>
                        )}
                      </div>
                      
                      {(!step.useTemplateDelay || isTemplate) ? (
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min="0"
                            value={delay.value}
                            onChange={(e) => {
                              const newDelay = inputToDelay(parseInt(e.target.value) || 0, delay.unit);
                              if (isTemplate) {
                                onUpdateStep(index, { delayMinutes: newDelay });
                              } else {
                                onUpdateStep(index, { customDelayMinutes: newDelay });
                              }
                            }}
                            className="w-24"
                          />
                          <select
                            value={delay.unit}
                            onChange={(e) => {
                              const newDelay = inputToDelay(delay.value, e.target.value);
                              if (isTemplate) {
                                onUpdateStep(index, { delayMinutes: newDelay });
                              } else {
                                onUpdateStep(index, { customDelayMinutes: newDelay });
                              }
                            }}
                            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="minutes">minutes</option>
                            <option value="hours">hours</option>
                            <option value="days">days</option>
                          </select>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          Using template: {formatDelay(templateStep.delayMinutes)}
                        </p>
                      )}
                    </div>

                    {/* Message */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Message</Label>
                        {!isTemplate && templateStep && (
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`template-msg-${index}`} className="text-xs text-muted-foreground">
                              Use template
                            </Label>
                            <Switch
                              id={`template-msg-${index}`}
                              checked={step.useTemplateMessage}
                              onCheckedChange={(checked) => onUpdateStep(index, { useTemplateMessage: checked })}
                            />
                          </div>
                        )}
                      </div>
                      
                      {(!step.useTemplateMessage || isTemplate) ? (
                        <Textarea
                          value={isTemplate ? step.messageTemplate : step.customMessage}
                          onChange={(e) => {
                            if (isTemplate) {
                              onUpdateStep(index, { messageTemplate: e.target.value });
                            } else {
                              onUpdateStep(index, { customMessage: e.target.value });
                            }
                          }}
                          placeholder="Hi {name}, ..."
                          rows={3}
                        />
                      ) : (
                        <div className="p-3 bg-muted rounded-md text-sm italic">
                          Using template: "{templateStep.messageTemplate?.substring(0, 100)}..."
                        </div>
                      )}
                      
                      <p className="text-xs text-muted-foreground">
                        Variables: {'{name}'}, {'{business_name}'}, {'{amount}'}, {'{payment_link}'}, {'{review_link}'}
                      </p>
                    </div>

                    {/* Skip conditions */}
                    <div className="space-y-2">
                      <Label>Skip this step if:</Label>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={step.skipConditions?.ifReplied || false}
                            onChange={(e) => onUpdateStep(index, {
                              skipConditions: {
                                ...step.skipConditions,
                                ifReplied: e.target.checked,
                              },
                            })}
                            className="rounded"
                          />
                          Lead replied
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={step.skipConditions?.ifScheduled || false}
                            onChange={(e) => onUpdateStep(index, {
                              skipConditions: {
                                ...step.skipConditions,
                                ifScheduled: e.target.checked,
                              },
                            })}
                            className="rounded"
                          />
                          Appointment scheduled
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={step.skipConditions?.ifPaid || false}
                            onChange={(e) => onUpdateStep(index, {
                              skipConditions: {
                                ...step.skipConditions,
                                ifPaid: e.target.checked,
                              },
                            })}
                            className="rounded"
                          />
                          Payment received
                        </label>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onMoveStep(index, 'up')}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onMoveStep(index, 'down')}
                          disabled={index === steps.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {steps.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onDeleteStep(index)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
}
```

---

## Step 6: Push Update Page

**CREATE** `src/app/admin/templates/[id]/push/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { flowTemplates, flows, clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { PushUpdateView } from '@/components/flows/push-update-view';

interface PageProps {
  params: { id: string };
}

export default async function PushUpdatePage({ params }: PageProps) {
  const [template] = await db
    .select()
    .from(flowTemplates)
    .where(eq(flowTemplates.id, params.id))
    .limit(1);

  if (!template) notFound();

  // Get all flows using this template with client info
  const usage = await db
    .select({
      flowId: flows.id,
      flowName: flows.name,
      syncMode: flows.syncMode,
      templateVersion: flows.templateVersion,
      clientId: clients.id,
      clientName: clients.businessName,
    })
    .from(flows)
    .innerJoin(clients, eq(flows.clientId, clients.id))
    .where(eq(flows.templateId, params.id));

  return (
    <div className="container py-6">
      <PushUpdateView template={template} usage={usage} />
    </div>
  );
}
```

**CREATE** `src/components/flows/push-update-view.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft,
  Upload,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  version: number;
}

interface FlowUsage {
  flowId: string;
  flowName: string;
  syncMode: string;
  templateVersion: number | null;
  clientId: string;
  clientName: string;
}

interface PushUpdateViewProps {
  template: Template;
  usage: FlowUsage[];
}

export function PushUpdateView({ template, usage }: PushUpdateViewProps) {
  const router = useRouter();
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const inherit = usage.filter(u => u.syncMode === 'inherit');
  const override = usage.filter(u => u.syncMode === 'override');
  const detached = usage.filter(u => u.syncMode === 'detached');
  const outdated = usage.filter(u => u.templateVersion !== template.version);

  const push = async () => {
    setPushing(true);
    try {
      const res = await fetch(`/api/admin/templates/${template.id}/push`, {
        method: 'POST',
      });

      const data = await res.json();
      setResult(data);
      toast.success(`Updated ${data.affected} client flows`);
    } catch (err) {
      toast.error('Failed to push update');
    } finally {
      setPushing(false);
    }
  };

  const dryRun = async () => {
    setPushing(true);
    try {
      const res = await fetch(`/api/admin/templates/${template.id}/push?dryRun=true`, {
        method: 'POST',
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      toast.error('Failed to preview');
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/admin/templates/${template.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Push Template Update</h1>
          <p className="text-muted-foreground">
            {template.name} • Version {template.version}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{usage.length}</div>
            <p className="text-sm text-muted-foreground">Total using template</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{inherit.length}</div>
            <p className="text-sm text-muted-foreground">Will update (inherit)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{override.length}</div>
            <p className="text-sm text-muted-foreground">Partial update (override)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-400">{detached.length}</div>
            <p className="text-sm text-muted-foreground">Won't update (detached)</p>
          </CardContent>
        </Card>
      </div>

      {/* Client list */}
      <Card>
        <CardHeader>
          <CardTitle>Affected Clients ({outdated.length} outdated)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {usage.map((u) => {
              const isOutdated = u.templateVersion !== template.version;
              const willUpdate = u.syncMode !== 'detached' && isOutdated;
              
              return (
                <div
                  key={u.flowId}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {willUpdate ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : u.syncMode === 'detached' ? (
                      <XCircle className="h-5 w-5 text-gray-400" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium">{u.clientName}</p>
                      <p className="text-sm text-muted-foreground">{u.flowName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      u.syncMode === 'inherit' ? 'default' :
                      u.syncMode === 'override' ? 'secondary' :
                      'outline'
                    }>
                      {u.syncMode}
                    </Badge>
                    {isOutdated && (
                      <Badge variant="destructive">
                        v{u.templateVersion} → v{template.version}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>
              {result.affected > 0 ? 'Update Complete' : 'Preview Results'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-green-600">✓ {result.affected} flows updated</p>
              <p className="text-gray-500">✗ {result.skipped} flows skipped</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <Button variant="outline" onClick={dryRun} disabled={pushing}>
          Preview Changes
        </Button>
        <Button onClick={push} disabled={pushing || outdated.length === 0}>
          {pushing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Push to {inherit.length + override.length} Clients
        </Button>
      </div>
    </div>
  );
}
```

---

## Step 7: Template API Routes

**CREATE** `src/app/api/admin/templates/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { flowTemplates, flowTemplateSteps } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { createTemplate } from '@/lib/services/flow-templates';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const templates = await db
    .select()
    .from(flowTemplates)
    .orderBy(desc(flowTemplates.updatedAt));

  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const template = await createTemplate(body);

  return NextResponse.json(template);
}
```

**CREATE** `src/app/api/admin/templates/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { flowTemplates, flowTemplateSteps } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [template] = await db
    .select()
    .from(flowTemplates)
    .where(eq(flowTemplates.id, params.id))
    .limit(1);

  if (!template) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const steps = await db
    .select()
    .from(flowTemplateSteps)
    .where(eq(flowTemplateSteps.templateId, params.id))
    .orderBy(flowTemplateSteps.stepNumber);

  return NextResponse.json({ ...template, steps });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { steps, tags, ...templateData } = body;

  // Update template
  await db
    .update(flowTemplates)
    .set({
      ...templateData,
      tags,
      updatedAt: new Date(),
    })
    .where(eq(flowTemplates.id, params.id));

  // Update steps
  if (steps) {
    // Delete existing steps
    await db.delete(flowTemplateSteps).where(eq(flowTemplateSteps.templateId, params.id));
    
    // Insert new steps
    for (const step of steps) {
      await db.insert(flowTemplateSteps).values({
        templateId: params.id,
        stepNumber: step.stepNumber,
        name: step.name,
        delayMinutes: step.delayMinutes,
        messageTemplate: step.messageTemplate,
        skipConditions: step.skipConditions,
      });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await db.delete(flowTemplates).where(eq(flowTemplates.id, params.id));

  return NextResponse.json({ success: true });
}
```

**CREATE** `src/app/api/admin/templates/[id]/publish/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { publishTemplate } from '@/lib/services/flow-templates';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const version = await publishTemplate(
    params.id,
    body.changeNotes,
    session.user.id
  );

  return NextResponse.json({ version });
}
```

**CREATE** `src/app/api/admin/templates/[id]/push/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { pushTemplateUpdate } from '@/lib/services/flow-templates';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dryRun') === 'true';

  const result = await pushTemplateUpdate(params.id, { dryRun });

  return NextResponse.json(result);
}
```

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/app/admin/templates/page.tsx` | Created |
| `src/app/admin/templates/[id]/page.tsx` | Created |
| `src/app/admin/templates/[id]/push/page.tsx` | Created |
| `src/components/flows/template-list.tsx` | Created |
| `src/components/flows/template-editor.tsx` | Created |
| `src/components/flows/sequence-view.tsx` | Created |
| `src/components/flows/push-update-view.tsx` | Created |
| `src/app/api/admin/templates/route.ts` | Created |
| `src/app/api/admin/templates/[id]/route.ts` | Created |
| `src/app/api/admin/templates/[id]/publish/route.ts` | Created |
| `src/app/api/admin/templates/[id]/push/route.ts` | Created |

---

## Verification

```bash
# 1. Navigate to template library
open http://localhost:3000/admin/templates

# 2. Create new template
# - Fill in name, category, steps
# - Save draft
# - Publish

# 3. Create client flow from template (via client setup)

# 4. Edit template and push update
# - Go to template > edit
# - Change a step message
# - Publish new version
# - Go to Push Update
# - Preview and push
```

## Success Criteria
- [ ] Template library shows all templates grouped by category
- [ ] Template editor allows editing steps in sequence view
- [ ] Publish creates new version
- [ ] Push update shows affected clients
- [ ] Dry run previews changes without applying
- [ ] Client flows update when push executed
- [ ] Override mode preserves customizations
