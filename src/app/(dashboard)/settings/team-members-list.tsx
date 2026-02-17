'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface TeamMember {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string | null;
  receiveEscalations: boolean | null;
  isActive: boolean | null;
}

export function TeamMembersList({ clientId }: { clientId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', phone: '', email: '', role: '' });

  useEffect(() => {
    fetchMembers();
  }, [clientId]);

  async function fetchMembers() {
    const res = await fetch(`/api/team-members?clientId=${clientId}`);
    const data = (await res.json()) as { members?: TeamMember[] };
    setMembers(data.members || []);
    setLoading(false);
  }

  async function addMember() {
    const res = await fetch('/api/team-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newMember, clientId }),
    });

    if (res.ok) {
      setNewMember({ name: '', phone: '', email: '', role: '' });
      setShowAdd(false);
      fetchMembers();
    }
  }

  async function toggleMember(id: string, isActive: boolean) {
    await fetch(`/api/team-members/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchMembers();
  }

  async function deleteMember(id: string) {
    if (!confirm('Remove this team member?')) return;
    await fetch(`/api/team-members/${id}`, { method: 'DELETE' });
    fetchMembers();
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      {members.length === 0 && !showAdd ? (
        <p className="text-muted-foreground text-sm">
          No team members yet. Add team members to receive escalation notifications.
        </p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg gap-2"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{member.name}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {member.phone} {member.email && `• ${member.email}`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {member.role && <Badge variant="outline">{member.role}</Badge>}
                <Badge variant={member.isActive ? 'default' : 'secondary'}>
                  {member.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleMember(member.id, member.isActive || false)}
                >
                  {member.isActive ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-sienna"
                  onClick={() => deleteMember(member.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="space-y-3 p-4 border rounded-lg">
          <Input
            placeholder="Name"
            value={newMember.name}
            onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
          />
          <Input
            placeholder="Phone (e.g., 403-555-1234)"
            value={newMember.phone}
            onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
          />
          <Input
            placeholder="Email (optional)"
            value={newMember.email}
            onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
          />
          <Input
            placeholder="Role (e.g., Sales, Estimator)"
            value={newMember.role}
            onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
          />
          <div className="flex gap-2">
            <Button onClick={addMember} disabled={!newMember.name || !newMember.phone}>
              Add Member
            </Button>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowAdd(true)}>
          + Add Team Member
        </Button>
      )}
    </div>
  );
}
