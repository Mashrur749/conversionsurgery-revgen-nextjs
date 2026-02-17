'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface PlanFeatures {
  maxLeadsPerMonth: number | null;
  maxTeamMembers: number | null;
  maxPhoneNumbers: number;
  includesVoiceAi: boolean;
  includesCalendarSync: boolean;
  includesAdvancedAnalytics: boolean;
  includesWhiteLabel: boolean;
  supportLevel: 'email' | 'priority' | 'dedicated';
  apiAccess: boolean;
  overagePerLeadCents?: number;
  overagePerSmsCents?: number;
  allowOverages?: boolean;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number | null;
  features: PlanFeatures;
  trialDays: number | null;
  isPopular: boolean | null;
  displayOrder: number | null;
  isActive: boolean | null;
}

interface PlanListProps {
  plans: Plan[];
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

export function PlanList({ plans: initialPlans }: PlanListProps) {
  const router = useRouter();
  const [plans, setPlans] = useState(initialPlans);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleActive = async (id: string, isActive: boolean) => {
    const res = await fetch(`/api/admin/plans/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    if (res.ok) {
      setPlans((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isActive } : p))
      );
    }
  };

  const savePlan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);

    const body = {
      name: form.get('name') as string,
      slug: form.get('slug') as string,
      description: form.get('description') as string,
      priceMonthly: Math.round(Number(form.get('priceMonthly')) * 100),
      priceYearly: form.get('priceYearly') ? Math.round(Number(form.get('priceYearly')) * 100) : undefined,
      trialDays: Number(form.get('trialDays') || 14),
      displayOrder: Number(form.get('displayOrder') || 0),
      isPopular: form.get('isPopular') === 'on',
      isActive: true,
      features: {
        maxLeadsPerMonth: form.get('maxLeads') ? Number(form.get('maxLeads')) : null,
        maxTeamMembers: form.get('maxTeam') ? Number(form.get('maxTeam')) : null,
        maxPhoneNumbers: Number(form.get('maxPhones') || 1),
        includesVoiceAi: form.get('voiceAi') === 'on',
        includesCalendarSync: form.get('calendarSync') === 'on',
        includesAdvancedAnalytics: form.get('analytics') === 'on',
        includesWhiteLabel: form.get('whiteLabel') === 'on',
        supportLevel: (form.get('supportLevel') || 'email') as 'email' | 'priority' | 'dedicated',
        apiAccess: form.get('apiAccess') === 'on',
        allowOverages: form.get('allowOverages') === 'on',
        overagePerLeadCents: form.get('overagePerLead') ? Math.round(Number(form.get('overagePerLead')) * 100) : undefined,
        overagePerSmsCents: form.get('overagePerSms') ? Math.round(Number(form.get('overagePerSms')) * 100) : undefined,
      },
    };

    if (editingPlan) {
      const res = await fetch(`/api/admin/plans/${editingPlan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEditingPlan(null);
        router.refresh();
      }
    } else {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setCreateOpen(false);
        router.refresh();
      }
    }
    setSaving(false);
  };

  const PlanForm = ({ plan }: { plan?: Plan }) => (
    <form onSubmit={savePlan} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required defaultValue={plan?.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" required defaultValue={plan?.slug} placeholder="starter" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={2} defaultValue={plan?.description || ''} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priceMonthly">Monthly Price ($)</Label>
          <Input id="priceMonthly" name="priceMonthly" type="number" step="0.01" required
            defaultValue={plan ? (plan.priceMonthly / 100).toFixed(2) : ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priceYearly">Yearly Price ($)</Label>
          <Input id="priceYearly" name="priceYearly" type="number" step="0.01"
            defaultValue={plan?.priceYearly ? (plan.priceYearly / 100).toFixed(2) : ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trialDays">Trial Days</Label>
          <Input id="trialDays" name="trialDays" type="number" defaultValue={plan?.trialDays ?? 14} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="maxLeads">Max Leads/Month</Label>
          <Input id="maxLeads" name="maxLeads" type="number" placeholder="Unlimited"
            defaultValue={plan?.features.maxLeadsPerMonth ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxTeam">Max Team Members</Label>
          <Input id="maxTeam" name="maxTeam" type="number" placeholder="Unlimited"
            defaultValue={plan?.features.maxTeamMembers ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxPhones">Max Phone Numbers</Label>
          <Input id="maxPhones" name="maxPhones" type="number" defaultValue={plan?.features.maxPhoneNumbers ?? 1} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {(['voiceAi', 'calendarSync', 'analytics', 'whiteLabel', 'apiAccess'] as const).map((key) => {
          const featureKey = key === 'voiceAi' ? 'includesVoiceAi'
            : key === 'calendarSync' ? 'includesCalendarSync'
            : key === 'analytics' ? 'includesAdvancedAnalytics'
            : key === 'whiteLabel' ? 'includesWhiteLabel'
            : 'apiAccess';
          return (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={key} defaultChecked={plan?.features[featureKey] ?? false} />
              {key === 'voiceAi' ? 'Voice AI' : key === 'calendarSync' ? 'Calendar Sync'
                : key === 'analytics' ? 'Advanced Analytics' : key === 'whiteLabel' ? 'White Label' : 'API Access'}
            </label>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="supportLevel">Support Level</Label>
          <select name="supportLevel" defaultValue={plan?.features.supportLevel ?? 'email'}
            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm">
            <option value="email">Email</option>
            <option value="priority">Priority</option>
            <option value="dedicated">Dedicated</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayOrder">Display Order</Label>
          <Input id="displayOrder" name="displayOrder" type="number" defaultValue={plan?.displayOrder ?? 0} />
        </div>
        <label className="flex items-center gap-2 text-sm pt-7">
          <input type="checkbox" name="isPopular" defaultChecked={plan?.isPopular ?? false} />
          Mark as Popular
        </label>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allowOverages" defaultChecked={plan?.features.allowOverages ?? false} />
          Allow Overages
        </label>
        <div className="space-y-2">
          <Label htmlFor="overagePerLead">Overage $/Lead</Label>
          <Input id="overagePerLead" name="overagePerLead" type="number" step="0.01" placeholder="e.g. 1.50"
            defaultValue={plan?.features.overagePerLeadCents ? (plan.features.overagePerLeadCents / 100).toFixed(2) : ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="overagePerSms">Overage $/SMS</Label>
          <Input id="overagePerSms" name="overagePerSms" type="number" step="0.01" placeholder="e.g. 0.05"
            defaultValue={plan?.features.overagePerSmsCents ? (plan.features.overagePerSmsCents / 100).toFixed(2) : ''} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : plan ? 'Update Plan' : 'Create Plan'}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 cursor-pointer">
            Add Plan
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Plan</DialogTitle>
            </DialogHeader>
            <PlanForm />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={!plan.isActive ? 'opacity-50' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <p className="text-2xl font-bold mt-1">{formatCents(plan.priceMonthly)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                </div>
                <div className="flex gap-1">
                  {plan.isPopular && <Badge className="bg-sage-light text-forest">Popular</Badge>}
                  {!plan.isActive && <Badge variant="secondary">Inactive</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {plan.description && (
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              )}
              <div className="text-sm space-y-1">
                <p>Leads: {plan.features.maxLeadsPerMonth ?? 'Unlimited'}</p>
                <p>Team: {plan.features.maxTeamMembers ?? 'Unlimited'}</p>
                <p>Phones: {plan.features.maxPhoneNumbers}</p>
                <p>Trial: {plan.trialDays} days</p>
                <p>Support: {plan.features.supportLevel}</p>
                {plan.features.allowOverages && (
                  <p className="text-muted-foreground">
                    Overages: {plan.features.overagePerLeadCents ? `$${(plan.features.overagePerLeadCents / 100).toFixed(2)}/lead` : '—'}
                    {plan.features.overagePerSmsCents ? `, $${(plan.features.overagePerSmsCents / 100).toFixed(2)}/SMS` : ''}
                  </p>
                )}
                {plan.features.allowOverages === false && plan.features.maxLeadsPerMonth && (
                  <p className="text-muted-foreground">Hard cap at limit</p>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {plan.features.includesVoiceAi && <Badge variant="outline">Voice AI</Badge>}
                {plan.features.includesCalendarSync && <Badge variant="outline">Calendar</Badge>}
                {plan.features.includesAdvancedAnalytics && <Badge variant="outline">Analytics</Badge>}
                {plan.features.includesWhiteLabel && <Badge variant="outline">White Label</Badge>}
                {plan.features.apiAccess && <Badge variant="outline">API</Badge>}
              </div>
              <div className="flex gap-2 pt-2">
                <Dialog open={editingPlan?.id === plan.id} onOpenChange={(open) => !open && setEditingPlan(null)}>
                  <Button variant="outline" size="sm" onClick={() => setEditingPlan(plan)}>
                    Edit
                  </Button>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Edit {plan.name}</DialogTitle>
                    </DialogHeader>
                    <PlanForm plan={plan} />
                  </DialogContent>
                </Dialog>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleActive(plan.id, !plan.isActive)}
                >
                  {plan.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
