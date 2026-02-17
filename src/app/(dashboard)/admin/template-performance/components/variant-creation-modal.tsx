'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, AlertCircle } from 'lucide-react';

const TEMPLATE_TYPES = [
  'missed_call',
  'form_response',
  'appointment_day_before',
  'followup_estimate',
  'payment_reminder',
  'review_request',
  'referral_request',
];

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function VariantCreationModal({ onClose, onSuccess }: Props) {
  const [templateType, setTemplateType] = useState('');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!templateType || !name || !content) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/admin/templates/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateType,
          name,
          content,
          notes,
        }),
      });

      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || 'Failed to create variant');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-2xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Create New Template Variant</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-destructive/30 bg-[#FDEAE4] p-4">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-sienna">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground">Template Type</label>
            <select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground"
              required
            >
              <option value="">Select a type...</option>
              {TEMPLATE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">Variant Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 'Standard', 'Aggressive', 'Friendly'"
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground placeholder-gray-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">Message Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Hi {name}, you have a missed call from {business}..."
              rows={6}
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground placeholder-gray-500"
              required
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Use variables like &#123;name&#125;, &#123;business&#125;, &#123;phone&#125; for personalization
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What's different about this variant? e.g., 'More urgent tone with emoji'"
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-foreground placeholder-gray-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-6">
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Variant'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
