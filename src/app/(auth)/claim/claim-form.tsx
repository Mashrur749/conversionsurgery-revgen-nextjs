'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TeamMember {
  id: string;
  name: string;
}

interface Props {
  token: string;
  members: TeamMember[];
  leadId: string;
}

export function ClaimForm({ token, members, leadId }: Props) {
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClaim() {
    if (!selectedMember) return;

    setLoading(true);
    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, teamMemberId: selectedMember }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/leads/${leadId}?claimed=true`);
      } else {
        alert(data.error || 'Failed to claim');
        if (data.error === 'Already claimed') {
          router.push(`/claim-error?reason=claimed&by=${encodeURIComponent(data.claimedBy)}`);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Select value={selectedMember} onValueChange={setSelectedMember}>
        <SelectTrigger>
          <SelectValue placeholder="Select your name..." />
        </SelectTrigger>
        <SelectContent>
          {members.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        onClick={handleClaim}
        disabled={!selectedMember || loading}
        className="w-full"
      >
        {loading ? 'Claiming...' : 'Claim & Respond'}
      </Button>
    </div>
  );
}
