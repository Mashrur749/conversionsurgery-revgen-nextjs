'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatPhoneNumber } from '@/lib/utils/phone';

interface DncEntry {
  id: string;
  phoneNumber: string;
  source: string;
  sourceReference: string | null;
  createdAt: string;
}

interface DncListResponse {
  entries: DncEntry[];
}

interface Props {
  clientId: string;
}

function sourceLabel(source: string): string {
  if (source === 'operator_exclusion') return 'Operator';
  if (source === 'opt_out') return 'Opt-out';
  if (source === 'national_dnc') return 'National DNC';
  if (source === 'tcpa_complaint') return 'TCPA Complaint';
  return source;
}

export function DncCard({ clientId }: Props) {
  const [entries, setEntries] = useState<DncEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addPhone, setAddPhone] = useState('');
  const [addReason, setAddReason] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Remove state
  const [removing, setRemoving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/dnc`);
      const payload = (await res.json()) as DncListResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error ?? `Failed to load exclusion list (${res.status})`);
      }
      setEntries(payload.entries ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load exclusion list'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [clientId]);

  async function handleAdd() {
    if (!addPhone.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/dnc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: addPhone.trim(),
          reason: addReason.trim() || undefined,
        }),
      });
      const payload = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? `Failed to add number (${res.status})`);
      }
      setAddPhone('');
      setAddReason('');
      setShowAddForm(false);
      await load();
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : 'Failed to add number'
      );
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(phoneNumber: string) {
    setRemoving(phoneNumber);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/dnc`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, reason: 'Removed by operator' }),
      });
      const payload = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? `Failed to remove number (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to remove number'
      );
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            Exclusion List
            {!loading && (
              <Badge variant="outline" className="ml-1 text-xs font-normal">
                {entries.length}
              </Badge>
            )}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowAddForm((prev) => !prev);
              setAddError('');
            }}
          >
            {showAddForm ? 'Cancel' : 'Add Number'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-[#C15B2E]/20 bg-[#FDEAE4] px-3 py-2 text-sm text-[#C15B2E]">
            {error}
          </div>
        )}

        {showAddForm && (
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm font-medium">Add number to exclusion list</p>
            <Input
              placeholder="Phone number (e.g. 604-555-0100)"
              value={addPhone}
              onChange={(e) => setAddPhone(e.target.value)}
              disabled={adding}
            />
            <Input
              placeholder="Reason (optional)"
              value={addReason}
              onChange={(e) => setAddReason(e.target.value)}
              disabled={adding}
            />
            {addError && (
              <p className="text-sm text-[#C15B2E]">{addError}</p>
            )}
            <Button
              size="sm"
              onClick={() => void handleAdd()}
              disabled={adding || !addPhone.trim()}
            >
              {adding ? 'Adding...' : 'Add'}
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading exclusion list...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No excluded contacts. Add numbers during onboarding to protect the
            contractor&apos;s personal relationships.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {formatPhoneNumber(entry.phoneNumber)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sourceLabel(entry.source)} &middot;{' '}
                    {new Date(entry.createdAt).toLocaleDateString('en-CA')}
                  </p>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={removing === entry.phoneNumber}
                      className="shrink-0 text-[#C15B2E] border-[#C15B2E]/30 hover:bg-[#FDEAE4]"
                    >
                      {removing === entry.phoneNumber ? 'Removing...' : 'Remove'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove from exclusion list?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {formatPhoneNumber(entry.phoneNumber)} will be removed from the
                        exclusion list. The system may resume sending messages to this
                        number if other conditions allow it.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => void handleRemove(entry.phoneNumber)}
                        className="bg-[#C15B2E] text-white hover:bg-[#A04A23]"
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
