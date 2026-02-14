'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';

interface LeadTagsProps {
  leadId: string;
  initialTags: string[];
}

export function LeadTags({ leadId, initialTags }: LeadTagsProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [saving, setSaving] = useState(false);

  async function updateTags(newTags: string[]) {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      });
      if (res.ok) {
        setTags(newTags);
      }
    } finally {
      setSaving(false);
    }
  }

  function addTag() {
    const tag = input.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      updateTags([...tags, tag]);
    }
    setInput('');
    setShowInput(false);
  }

  function removeTag(tag: string) {
    updateTags(tags.filter((t) => t !== tag));
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 text-xs">
          {tag}
          <button onClick={() => removeTag(tag)} className="hover:text-destructive" disabled={saving}>
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {showInput ? (
        <form
          onSubmit={(e) => { e.preventDefault(); addTag(); }}
          className="flex items-center gap-1"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="tag name"
            className="border rounded px-2 py-0.5 text-xs w-24"
            autoFocus
            onBlur={() => { if (!input) setShowInput(false); }}
          />
          <Button type="submit" variant="ghost" size="sm" className="h-6 px-1" disabled={saving}>
            Add
          </Button>
        </form>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1"
          onClick={() => setShowInput(true)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
