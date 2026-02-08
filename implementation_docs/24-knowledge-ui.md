# Phase 15b: Knowledge Base UI

## Current State (after Phase 15a)
- Knowledge base schema and API exist
- Default entries initialize
- No UI to manage knowledge

## Goal
Admin UI to add, edit, and manage client knowledge base.

---

## Step 1: Create Knowledge Base Page

**CREATE** `src/app/(dashboard)/admin/clients/[id]/knowledge/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getClientKnowledge, initializeClientKnowledge } from '@/lib/services/knowledge-base';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { KnowledgeList } from './knowledge-list';

interface Props {
  params: { id: string };
}

export default async function KnowledgeBasePage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/dashboard');

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, params.id))
    .limit(1);

  if (!client) notFound();

  await initializeClientKnowledge(params.id);
  const entries = await getClientKnowledge(params.id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">{client.businessName}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/clients/${params.id}`}>← Back</Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/clients/${params.id}/knowledge/new`}>+ Add Entry</Link>
          </Button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900">How AI Uses This</h3>
        <p className="text-sm text-blue-700 mt-1">
          When leads ask questions, the AI uses this knowledge base to give accurate, 
          business-specific answers. Update this information to help the AI respond correctly.
        </p>
      </div>

      <KnowledgeList clientId={params.id} entries={entries} />
    </div>
  );
}
```

---

## Step 2: Create Knowledge List Component

**CREATE** `src/app/(dashboard)/admin/clients/[id]/knowledge/knowledge-list.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string | null;
  priority: number | null;
}

interface Props {
  clientId: string;
  entries: KnowledgeEntry[];
}

const categoryLabels: Record<string, { label: string; color: string }> = {
  services: { label: 'Services', color: 'bg-blue-100 text-blue-800' },
  pricing: { label: 'Pricing', color: 'bg-green-100 text-green-800' },
  faq: { label: 'FAQ', color: 'bg-purple-100 text-purple-800' },
  policies: { label: 'Policies', color: 'bg-yellow-100 text-yellow-800' },
  about: { label: 'About', color: 'bg-gray-100 text-gray-800' },
  custom: { label: 'Custom', color: 'bg-orange-100 text-orange-800' },
};

export function KnowledgeList({ clientId, entries }: Props) {
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm('Delete this entry?')) return;

    await fetch(`/api/admin/clients/${clientId}/knowledge/${id}`, {
      method: 'DELETE',
    });
    router.refresh();
  }

  // Group by category
  const byCategory: Record<string, KnowledgeEntry[]> = {};
  for (const entry of entries) {
    if (!byCategory[entry.category]) {
      byCategory[entry.category] = [];
    }
    byCategory[entry.category].push(entry);
  }

  const categoryOrder = ['about', 'services', 'pricing', 'policies', 'faq', 'custom'];

  return (
    <div className="space-y-6">
      {categoryOrder.map((category) => {
        const categoryEntries = byCategory[category];
        if (!categoryEntries?.length) return null;

        const catInfo = categoryLabels[category] || { label: category, color: 'bg-gray-100' };

        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge className={catInfo.color}>{catInfo.label}</Badge>
                <span className="text-sm text-muted-foreground font-normal">
                  {categoryEntries.length} entries
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {categoryEntries.map((entry) => (
                <div key={entry.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium">{entry.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {entry.content.length > 200
                          ? `${entry.content.slice(0, 200)}...`
                          : entry.content}
                      </p>
                      {entry.keywords && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Keywords: {entry.keywords}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/clients/${clientId}/knowledge/${entry.id}`}>
                          Edit
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => handleDelete(entry.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {entries.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No knowledge entries yet. Add your first entry to help the AI respond accurately.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

## Step 3: Create New Entry Page

**CREATE** `src/app/(dashboard)/admin/clients/[id]/knowledge/new/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KnowledgeEntryForm } from '../knowledge-entry-form';

interface Props {
  params: { id: string };
}

export default async function NewKnowledgeEntryPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/dashboard');

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Add Knowledge Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <KnowledgeEntryForm clientId={params.id} />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Step 4: Create Edit Entry Page

**CREATE** `src/app/(dashboard)/admin/clients/[id]/knowledge/[entryId]/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { knowledgeBase } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KnowledgeEntryForm } from '../knowledge-entry-form';

interface Props {
  params: { id: string; entryId: string };
}

export default async function EditKnowledgeEntryPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/dashboard');

  const [entry] = await db
    .select()
    .from(knowledgeBase)
    .where(eq(knowledgeBase.id, params.entryId))
    .limit(1);

  if (!entry) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Edit Knowledge Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <KnowledgeEntryForm clientId={params.id} entry={entry} />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Step 5: Create Knowledge Entry Form Component

**CREATE** `src/app/(dashboard)/admin/clients/[id]/knowledge/knowledge-entry-form.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

interface Entry {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string | null;
  priority: number | null;
}

interface Props {
  clientId: string;
  entry?: Entry;
}

export function KnowledgeEntryForm({ clientId, entry }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    category: entry?.category || 'services',
    title: entry?.title || '',
    content: entry?.content || '',
    keywords: entry?.keywords || '',
    priority: entry?.priority || 5,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const url = entry
      ? `/api/admin/clients/${clientId}/knowledge/${entry.id}`
      : `/api/admin/clients/${clientId}/knowledge`;

    await fetch(url, {
      method: entry ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    router.push(`/admin/clients/${clientId}/knowledge`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Category</Label>
        <Select
          value={formData.category}
          onValueChange={(v) => setFormData({ ...formData, category: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="about">About</SelectItem>
            <SelectItem value="services">Services</SelectItem>
            <SelectItem value="pricing">Pricing</SelectItem>
            <SelectItem value="policies">Policies</SelectItem>
            <SelectItem value="faq">FAQ</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Title</Label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Roof Repair Services"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Content</Label>
        <Textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={6}
          placeholder="Describe in detail. The AI will use this to answer customer questions."
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Keywords (optional)</Label>
        <Input
          value={formData.keywords}
          onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
          placeholder="roof, repair, leak, damage"
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated words that help match this entry to questions
        </p>
      </div>

      <div className="space-y-2">
        <Label>Priority (1-10)</Label>
        <Input
          type="number"
          min="1"
          max="10"
          value={formData.priority}
          onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 5 })}
        />
        <p className="text-xs text-muted-foreground">
          Higher priority entries are shown first to the AI
        </p>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : entry ? 'Save Changes' : 'Add Entry'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/admin/clients/${clientId}/knowledge`)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
```

---

## Step 6: Add Knowledge Link to Client Detail Page

**UPDATE** `src/app/(dashboard)/admin/clients/[id]/page.tsx`:

Add in the buttons area:

```typescript
<Button asChild variant="outline">
  <Link href={`/admin/clients/${client.id}/knowledge`}>
    📚 Knowledge Base
  </Link>
</Button>
```

---

## Verify

1. `npm run dev`
2. Go to Admin → Client → Knowledge Base
3. See default entries
4. Click "Add Entry" → fill form → save
5. Edit existing entries
6. Delete entries

---

## Next
Proceed to **Phase 15c** for AI integration.
