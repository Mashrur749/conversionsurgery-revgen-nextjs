'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const [removeId, setRemoveId] = useState<string | null>(null);

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

  async function handleRemove() {
    if (!removeId) return;
    await fetch(`/api/admin/clients/${clientId}/phone-numbers/${removeId}`, {
      method: 'DELETE',
    });
    setRemoveId(null);
    fetchNumbers();
  }

  if (loading) return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-28" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border rounded p-2">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-8" />
          </div>
        ))}
      </CardContent>
    </Card>
  );

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
            <Input
              placeholder="Phone number (+1XXXXXXXXXX)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <Input
              placeholder="Friendly name (optional)"
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
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
                  <Button variant="ghost" size="sm" onClick={() => setRemoveId(n.id)} title="Remove">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!removeId} onOpenChange={() => setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Phone Number</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this phone number from the client. Any active automations using it will be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
