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
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClaim() {
    if (!selectedMember) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, teamMemberId: selectedMember }),
      });

      const data = await res.json() as { success: boolean; error?: string; claimedBy?: string };

      if (data.success) {
        router.push(`/leads/${leadId}?claimed=true`);
      } else {
        if (data.error === 'Already claimed') {
          router.push(`/claim-error?reason=claimed&by=${encodeURIComponent(data.claimedBy || 'Someone')}`);
        } else {
          setError(data.error || 'Failed to claim. Please try again.');
        }
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
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
