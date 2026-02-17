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

      <div className="flex gap-2 pt-4 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/admin/clients/${clientId}/knowledge`)}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : entry ? 'Save Changes' : 'Add Entry'}
        </Button>
      </div>
    </form>
  );
}
