'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email?: string | null;
  phone: string;
  role?: string | null;
  receiveEscalations: boolean;
  receiveHotTransfers: boolean;
}

interface Props {
  clientId: string;
}

export function TeamManager({ clientId }: Props) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  // Form state for adding new member
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'support',
  });

  // Load team members on mount
  useEffect(() => {
    loadMembers();
  }, [clientId]);

  async function loadMembers() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/team-members?clientId=${clientId}`);
      const data = (await res.json()) as { teamMembers?: TeamMember[]; error?: string };

      if (!res.ok) {
        setError(data.error || 'Failed to load team members');
        return;
      }

      setMembers(data.teamMembers || []);
    } catch (err) {
      console.error('Error loading team members:', err);
      setError('Failed to load team members');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError('');

    try {
      const res = await fetch('/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          name: newMember.name,
          email: newMember.email || undefined,
          phone: newMember.phone,
          role: newMember.role,
        }),
      });

      const data = (await res.json()) as { teamMember?: TeamMember; error?: string };

      if (!res.ok) {
        setError(data.error || 'Failed to add team member');
        return;
      }

      // Reload members
      await loadMembers();

      // Reset form
      setNewMember({ name: '', email: '', phone: '', role: 'support' });
    } catch (err) {
      console.error('Error adding team member:', err);
      setError('Failed to add team member');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Are you sure you want to remove this team member?')) {
      return;
    }

    try {
      setError('');
      const res = await fetch(`/api/team-members?memberId=${memberId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        setError('Failed to remove team member');
        return;
      }

      // Reload members
      await loadMembers();
    } catch (err) {
      console.error('Error removing team member:', err);
      setError('Failed to remove team member');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
        <CardDescription>Add and manage team members for this client</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">{error}</div>
        )}

        {/* Add Member Form */}
        <form onSubmit={handleAddMember} className="space-y-4 pb-6 border-b">
          <h3 className="font-semibold text-sm">Add New Member</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                placeholder="john@company.com"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={newMember.phone}
                onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                placeholder="403-555-0100"
                required
              />
            </div>

            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={newMember.role} onValueChange={(role) => setNewMember({ ...newMember, role })}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="lead">Lead/Sales</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={adding}>
              {adding ? 'Adding...' : '+ Add Member'}
            </Button>
          </div>
        </form>

        {/* Members List */}
        <div>
          <h3 className="font-semibold text-sm mb-4">
            Current Members ({members.length})
          </h3>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No team members added yet. Add one using the form above.
            </p>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-start justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{member.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {member.role || 'member'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {member.email && <p>{member.email}</p>}
                      <p>{member.phone}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMember(member.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
