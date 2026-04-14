'use client';

import { useState } from 'react';

export interface TeamMember {
  membershipId: string;
  name: string;
}

interface Props {
  escalationId: string;
  currentAssignedTo: string | null;
  teamMembers: TeamMember[];
}

const SELECT_STYLE =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring';

export function EscalationAssignSelect({
  escalationId,
  currentAssignedTo,
  teamMembers,
}: Props) {
  const [value, setValue] = useState(currentAssignedTo ?? '');
  const [saving, setSaving] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setValue(next);
    setSaving(true);

    try {
      await fetch(`/api/admin/escalations/${escalationId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: next === '' ? null : next }),
      });
    } catch {
      // Revert on failure
      setValue(currentAssignedTo ?? '');
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={saving}
      className={SELECT_STYLE}
      aria-label="Assign to team member"
    >
      <option value="">Unassigned</option>
      {teamMembers.map((m) => (
        <option key={m.membershipId} value={m.membershipId}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
