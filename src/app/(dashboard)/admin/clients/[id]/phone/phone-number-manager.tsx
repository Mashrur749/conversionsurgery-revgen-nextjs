'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Star } from 'lucide-react';

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName: string | null;
  isPrimary: boolean;
  isActive: boolean;
  capabilities: { sms: boolean; voice: boolean; mms: boolean } | null;
  createdAt: string;
}

export function PhoneNumberManager({ clientId }: { clientId: string }) {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [friendlyName, setFriendlyName] = useState('');

  async function fetchNumbers() {
    const res = await fetch(`/api/admin/clients/${clientId}/phone-numbers`);
    if (res.ok) setNumbers(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchNumbers(); }, [clientId]);

  async function handleAdd() {
    const res = await fetch(`/api/admin/clients/${clientId}/phone-numbers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, friendlyName: friendlyName || undefined }),
    });
    if (res.ok) {
      setPhoneNumber('');
      setFriendlyName('');
      setShowAdd(false);
      fetchNumbers();
    }
  }

  async function handleSetPrimary(phoneId: string) {
    await fetch(`/api/admin/clients/${clientId}/phone-numbers/${phoneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPrimary: true }),
    });
    fetchNumbers();
  }

  async function handleRemove(phoneId: string) {
    await fetch(`/api/admin/clients/${clientId}/phone-numbers/${phoneId}`, {
      method: 'DELETE',
    });
    fetchNumbers();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading numbers...</p>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Phone Numbers</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4 mr-1" /> Add Number
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && (
          <div className="border rounded p-3 space-y-2">
            <input
              placeholder="Phone number (+1XXXXXXXXXX)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full"
            />
            <input
              placeholder="Friendly name (optional)"
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!phoneNumber}>Add</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {numbers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No phone numbers assigned.</p>
        ) : (
          <div className="space-y-2">
            {numbers.map((n) => (
              <div key={n.id} className="flex items-center justify-between border rounded p-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{n.phoneNumber}</span>
                    {n.isPrimary && <Badge className="text-xs">Primary</Badge>}
                    {n.friendlyName && (
                      <span className="text-xs text-muted-foreground">{n.friendlyName}</span>
                    )}
                  </div>
                  {n.capabilities && (
                    <div className="flex gap-1 mt-1">
                      {n.capabilities.sms && <Badge variant="secondary" className="text-xs">SMS</Badge>}
                      {n.capabilities.voice && <Badge variant="secondary" className="text-xs">Voice</Badge>}
                      {n.capabilities.mms && <Badge variant="secondary" className="text-xs">MMS</Badge>}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  {!n.isPrimary && (
                    <Button variant="ghost" size="sm" onClick={() => handleSetPrimary(n.id)} title="Set as primary">
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleRemove(n.id)} title="Remove">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
