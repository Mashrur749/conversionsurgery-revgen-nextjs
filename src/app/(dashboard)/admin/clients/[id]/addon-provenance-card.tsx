'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AddonEvent {
  id: string;
  addonType: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  periodStart: string;
  periodEnd: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceLineItemRef: string | null;
  disputeStatus: 'none' | 'reviewing' | 'disputed' | 'resolved';
  disputeNote: string | null;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function AddonProvenanceCard({ clientId }: { clientId: string }) {
  const [events, setEvents] = useState<AddonEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/billing/addons`);
      if (!res.ok) throw new Error('Failed to load add-on billing events');
      const data = (await res.json()) as { events: AddonEvent[] };
      setEvents(data.events);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, [clientId]);

  async function saveDispute(event: AddonEvent) {
    setSavingId(event.id);
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/billing/addons/${event.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            disputeStatus: event.disputeStatus,
            disputeNote: event.disputeNote,
          }),
        }
      );
      if (!res.ok) throw new Error('Failed to save dispute annotation');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add-On Charge Provenance</CardTitle>
        <CardDescription>
          Review charge sources, invoice linkage, and dispute annotations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading add-on events...</p>}
        {!loading && events.length === 0 && (
          <p className="text-sm text-muted-foreground">No add-on billing events yet.</p>
        )}
        {!loading && events.length > 0 && (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{event.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Qty {event.quantity} @ {formatMoney(event.unitPriceCents)} = {formatMoney(event.totalCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Period {event.periodStart.slice(0, 10)} to {event.periodEnd.slice(0, 10)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Invoice {event.invoiceNumber || 'Unlinked'} {event.invoiceLineItemRef ? `(${event.invoiceLineItemRef})` : ''}
                    </p>
                  </div>
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={event.disputeStatus}
                    onChange={(e) =>
                      setEvents((prev) =>
                        prev.map((row) =>
                          row.id === event.id
                            ? { ...row, disputeStatus: e.target.value as AddonEvent['disputeStatus'] }
                            : row
                        )
                      )
                    }
                  >
                    <option value="none">No Dispute</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="disputed">Disputed</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                <textarea
                  className="w-full border rounded px-2 py-1 text-sm"
                  rows={2}
                  placeholder="Dispute/support note"
                  value={event.disputeNote || ''}
                  onChange={(e) =>
                    setEvents((prev) =>
                      prev.map((row) =>
                        row.id === event.id
                          ? { ...row, disputeNote: e.target.value }
                          : row
                      )
                    )
                  }
                />

                <Button
                  size="sm"
                  variant="outline"
                  disabled={savingId === event.id}
                  onClick={() => void saveDispute(event)}
                >
                  {savingId === event.id ? 'Saving...' : 'Save Annotation'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
