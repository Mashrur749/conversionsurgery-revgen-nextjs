'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TIMEZONES = [
  { value: 'America/Vancouver', label: 'Pacific (Vancouver)' },
  { value: 'America/Edmonton', label: 'Mountain (Edmonton)' },
  { value: 'America/Winnipeg', label: 'Central (Winnipeg)' },
  { value: 'America/Toronto', label: 'Eastern (Toronto)' },
  { value: 'America/Halifax', label: 'Atlantic (Halifax)' },
];

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface Client {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  timezone: string | null;
  googleBusinessUrl: string | null;
  notificationEmail: boolean | null;
  notificationSms: boolean | null;
  status: string | null;
  monthlyMessageLimit: number | null;
}

export function EditClientForm({ client }: { client: Client }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    businessName: client.businessName,
    ownerName: client.ownerName,
    email: client.email,
    phone: client.phone,
    timezone: client.timezone || 'America/Edmonton',
    googleBusinessUrl: client.googleBusinessUrl || '',
    notificationEmail: client.notificationEmail ?? true,
    notificationSms: client.notificationSms ?? true,
    status: client.status || 'pending',
    monthlyMessageLimit: client.monthlyMessageLimit || 500,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error || 'Failed to update');
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-destructive bg-[#FDEAE4] rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 text-sm text-[#3D7A50] bg-[#E8F5E9] rounded-lg">
          Client updated successfully
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="businessName">Business Name</Label>
        <Input
          id="businessName"
          value={formData.businessName}
          onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ownerName">Owner Name</Label>
        <Input
          id="ownerName"
          value={formData.ownerName}
          onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select
            value={formData.timezone}
            onValueChange={(value) => setFormData({ ...formData, timezone: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="googleBusinessUrl">Google Business URL</Label>
        <Input
          id="googleBusinessUrl"
          type="url"
          value={formData.googleBusinessUrl}
          onChange={(e) => setFormData({ ...formData, googleBusinessUrl: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="monthlyMessageLimit">Monthly Message Limit</Label>
        <Input
          id="monthlyMessageLimit"
          type="number"
          value={formData.monthlyMessageLimit}
          onChange={(e) => setFormData({ ...formData, monthlyMessageLimit: parseInt(e.target.value) })}
        />
      </div>

      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <Label htmlFor="notificationEmail">Email Notifications</Label>
          <Switch
            id="notificationEmail"
            checked={formData.notificationEmail}
            onCheckedChange={(checked) => setFormData({ ...formData, notificationEmail: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="notificationSms">SMS Notifications</Label>
          <Switch
            id="notificationSms"
            checked={formData.notificationSms}
            onCheckedChange={(checked) => setFormData({ ...formData, notificationSms: checked })}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
