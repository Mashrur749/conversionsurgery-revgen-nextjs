'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatPhoneNumber } from '@/lib/utils/phone';
import type { WizardData } from '../setup-wizard';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  onBack: () => void;
  onComplete: () => void;
  onGoToStep: (step: number) => void;
}

export function StepReview({ data, updateData, onBack, onComplete, onGoToStep }: Props) {
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');

  // Inline editing state for business info
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [editFields, setEditFields] = useState({
    businessName: data.businessName,
    ownerName: data.ownerName,
    email: data.email,
    phone: data.phone,
  });

  async function handleActivate() {
    if (!data.clientId) {
      setError('Client not created');
      return;
    }

    setActivating(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/clients/${data.clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });

      if (!res.ok) {
        const result = (await res.json()) as { error?: string };
        setError(result.error || 'Failed to activate');
        return;
      }

      onComplete();
    } catch {
      setError('Something went wrong');
    } finally {
      setActivating(false);
    }
  }

  function saveBusiness() {
    if (!editFields.businessName.trim() || !editFields.email.trim()) {
      return;
    }
    updateData({
      businessName: editFields.businessName.trim(),
      ownerName: editFields.ownerName.trim(),
      email: editFields.email.trim(),
      phone: editFields.phone.trim(),
    });
    setEditingBusiness(false);
  }

  const openDays = data.businessHours.filter(h => h.isOpen);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Review the setup and activate the client when ready.
      </p>

      {error && (
        <div className="p-3 text-sm text-destructive bg-[#FDEAE4] rounded-lg">
          {error}
        </div>
      )}

      {/* Business Info */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Business Information</h3>
          {editingBusiness ? (
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditFields({
                    businessName: data.businessName,
                    ownerName: data.ownerName,
                    email: data.email,
                    phone: data.phone,
                  });
                  setEditingBusiness(false);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={saveBusiness}>
                Save
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingBusiness(true)}
            >
              Edit
            </Button>
          )}
        </div>

        {editingBusiness ? (
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
              <span className="text-muted-foreground">Business Name</span>
              <Input
                value={editFields.businessName}
                onChange={(e) =>
                  setEditFields((f) => ({ ...f, businessName: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
              <span className="text-muted-foreground">Owner</span>
              <Input
                value={editFields.ownerName}
                onChange={(e) =>
                  setEditFields((f) => ({ ...f, ownerName: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
              <span className="text-muted-foreground">Email</span>
              <Input
                type="email"
                value={editFields.email}
                onChange={(e) =>
                  setEditFields((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
              <span className="text-muted-foreground">Phone</span>
              <Input
                value={editFields.phone}
                onChange={(e) =>
                  setEditFields((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Business Name</span>
              <span className="font-medium">{data.businessName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Owner</span>
              <span>{data.ownerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{data.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span>{data.phone}</span>
            </div>
          </div>
        )}
      </div>

      {/* Phone Number */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Twilio Number</h3>
          <Button variant="ghost" size="sm" onClick={() => onGoToStep(1)}>
            {data.twilioNumber ? 'Change' : 'Assign'}
          </Button>
        </div>
        {data.twilioNumber ? (
          <div className="flex items-center justify-between">
            <span className="font-mono text-lg">
              {formatPhoneNumber(data.twilioNumber)}
            </span>
            <Badge className="bg-[#E8F5E9] text-[#3D7A50]">Assigned</Badge>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">No number assigned</span>
            <Badge variant="outline" className="text-olive">Optional</Badge>
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Team Members</h3>
          <Button variant="ghost" size="sm" onClick={() => onGoToStep(2)}>
            Edit
          </Button>
        </div>
        {data.teamMembers.length > 0 ? (
          <div className="space-y-2">
            {data.teamMembers.map((member, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{member.name}</span>
                <span className="text-muted-foreground">{member.phone}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No team members added (escalations go to owner only)
          </p>
        )}
      </div>

      {/* Business Hours */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Business Hours</h3>
          <Button variant="ghost" size="sm" onClick={() => onGoToStep(3)}>
            Edit
          </Button>
        </div>
        {openDays.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {openDays.map((h) => (
              <Badge key={h.dayOfWeek} variant="outline">
                {DAYS[h.dayOfWeek]} {h.openTime}-{h.closeTime}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No business hours set (hot transfers disabled)
          </p>
        )}
      </div>

      {/* Warnings */}
      {(!data.twilioNumber || data.teamMembers.length === 0) && (
        <div className="bg-accent border border-olive/30 rounded-lg p-4">
          <h4 className="font-medium text-forest mb-2">Heads up:</h4>
          <ul className="text-sm text-olive space-y-1">
            {!data.twilioNumber && (
              <li>No phone number assigned — you can add one later from client settings</li>
            )}
            {data.teamMembers.length === 0 && (
              <li>No team members — escalations will only go to the owner</li>
            )}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={handleActivate}
          disabled={activating}
          className="min-w-32"
        >
          {activating ? 'Activating...' : 'Activate Client'}
        </Button>
      </div>
    </div>
  );
}
