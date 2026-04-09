'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { WizardData } from '../setup-wizard';
import { normalizePhoneNumber } from '@/lib/utils/phone';

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepTeamMembers({ data, updateData, onNext, onBack }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    phone: '',
    email: '',
    role: '',
  });
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  function validatePhone(phone: string): string | null {
    if (!phone) return null;
    try {
      const normalized = normalizePhoneNumber(phone);
      if (!normalized || normalized.length < 10) {
        return 'Enter a 10-digit phone number including area code';
      }
      return null;
    } catch {
      return 'Enter a 10-digit phone number including area code';
    }
  }

  function addMember() {
    if (!newMember.name || !newMember.phone) {
      setError('Name and phone are required');
      return;
    }

    const phoneErr = validatePhone(newMember.phone);
    if (phoneErr) {
      setPhoneError(phoneErr);
      return;
    }

    updateData({
      teamMembers: [...data.teamMembers, { ...newMember }],
    });

    setNewMember({ name: '', phone: '', email: '', role: '' });
    setShowAdd(false);
    setError('');
    setPhoneError('');
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
      const failures: string[] = [];

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
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          failures.push(`${member.name}: ${body.error || 'Failed to save team member'}`);
        }
      }

      if (failures.length > 0) {
        setError(failures.join(' | '));
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
        <div className="p-3 text-sm text-destructive bg-[#FDEAE4] rounded-lg">
          {error}
        </div>
      )}

      {data.teamMembers.length > 0 && (
        <div className="border rounded-lg divide-y">
          {data.teamMembers.map((member, index) => (
            <div key={index} className="flex items-center justify-between p-3">
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-sm text-muted-foreground">
                  {member.phone}
                  {member.email && ` • ${member.email}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {member.role && (
                  <Badge variant="outline">{member.role}</Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => removeMember(index)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                placeholder="John Smith"
              />
            </div>
            <div className="space-y-1">
              <Label>Phone *</Label>
              <Input
                value={newMember.phone}
                onChange={(e) => {
                  setNewMember({ ...newMember, phone: e.target.value });
                  if (phoneError) setPhoneError('');
                }}
                onBlur={() => {
                  const err = validatePhone(newMember.phone);
                  if (err) setPhoneError(err);
                }}
                placeholder="403-555-1234"
                className={phoneError ? 'border-[#C15B2E]' : ''}
              />
              {phoneError && (
                <p className="text-xs text-[#C15B2E]">{phoneError}</p>
              )}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Input
                value={newMember.role}
                onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                placeholder="Sales, Estimator, etc."
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={addMember}>Add Member</Button>
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

      {data.teamMembers.length === 0 && (
        <p className="text-sm text-olive bg-accent p-3 rounded-lg">
          Without team members, escalations will only go to the business owner.
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
