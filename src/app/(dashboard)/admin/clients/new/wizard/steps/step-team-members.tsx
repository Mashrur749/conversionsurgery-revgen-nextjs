'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WizardData } from '../setup-wizard';

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const ROLES = [
  { value: 'manager', label: 'Manager' },
  { value: 'lead', label: 'Lead/Sales' },
  { value: 'support', label: 'Support' },
  { value: 'admin', label: 'Admin' },
];

export function StepTeamMembers({ data, updateData, onNext, onBack }: Props) {
  const [newMember, setNewMember] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'lead',
  });
  const [error, setError] = useState('');

  function addMember() {
    setError('');

    if (!newMember.name || !newMember.phone || !newMember.email) {
      setError('Please fill in all team member fields');
      return;
    }

    if (!newMember.email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    updateData({
      teamMembers: [...data.teamMembers, newMember],
    });

    setNewMember({
      name: '',
      phone: '',
      email: '',
      role: 'lead',
    });
  }

  function removeMember(index: number) {
    updateData({
      teamMembers: data.teamMembers.filter((_, i) => i !== index),
    });
  }

  async function handleNext() {
    setError('');

    // Save team members to database if we have any
    if (data.teamMembers.length > 0 && data.clientId) {
      try {
        for (const member of data.teamMembers) {
          const res = await fetch('/api/team-members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: data.clientId,
              name: member.name,
              phone: member.phone,
              email: member.email || undefined,
              role: member.role || undefined,
            }),
          });

          if (!res.ok) {
            const result = (await res.json()) as { error?: string };
            setError(result.error || 'Failed to save team member');
            return;
          }
        }
      } catch (err) {
        setError('Something went wrong saving team members');
        return;
      }
    }

    onNext();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add team members who will receive escalation notifications when AI can't answer a question.
        They'll get SMS alerts with a link to claim and respond to the lead.
      </p>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      {/* Add Member Form */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="font-semibold mb-4">Add Team Member</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="memberName">Name</Label>
            <Input
              id="memberName"
              value={newMember.name}
              onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
              placeholder="Jane Doe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="memberEmail">Email</Label>
            <Input
              id="memberEmail"
              type="email"
              value={newMember.email}
              onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
              placeholder="jane@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="memberPhone">Phone</Label>
            <Input
              id="memberPhone"
              type="tel"
              value={newMember.phone}
              onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
              placeholder="403-555-1234"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="memberRole">Role</Label>
            <Select
              value={newMember.role}
              onValueChange={(value) => setNewMember({ ...newMember, role: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={addMember} className="mt-4 w-full">
          Add Member
        </Button>
      </div>

      {/* Team Members List */}
      {data.teamMembers.length > 0 && (
        <div className="space-y-2">
          <p className="font-semibold text-sm">{data.teamMembers.length} Member(s) Added</p>
          {data.teamMembers.map((member, index) => (
            <Card key={index} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                  <p className="text-sm text-muted-foreground">{member.phone}</p>
                  <p className="text-xs mt-1">
                    <span className="inline-block px-2 py-1 bg-blue-50 text-blue-700 rounded">
                      {ROLES.find((r) => r.value === member.role)?.label}
                    </span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMember(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {data.teamMembers.length === 0 && (
        <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
          ⚠️ Without team members, escalations will only go to the business owner.
          You can add team members later from the settings page.
        </p>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={handleNext}>
          Next: Business Hours →
        </Button>
      </div>
    </div>
  );
}
