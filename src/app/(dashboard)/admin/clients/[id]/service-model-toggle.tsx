'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  clientId: string;
  initialModel: string;
}

export function ServiceModelToggle({ clientId, initialModel }: Props) {
  const [model, setModel] = useState(initialModel);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = model === 'managed' ? 'self_serve' : 'managed';
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceModel: next }),
      });
      if (res.ok) {
        setModel(next);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      title="Click to toggle service model"
      className={cn(
        'text-xs px-2 py-0.5 rounded-full font-normal cursor-pointer transition-colors',
        model === 'managed'
          ? 'bg-[#E3E9E1] text-[#1B2F26] hover:bg-[#C8D4CC]'
          : 'bg-[#E8F5E9] text-[#3D7A50] hover:bg-[#D4ECD8]',
        saving && 'opacity-50'
      )}
    >
      {saving ? 'Saving...' : model === 'managed' ? 'Managed' : 'Self-Serve'}
    </button>
  );
}
