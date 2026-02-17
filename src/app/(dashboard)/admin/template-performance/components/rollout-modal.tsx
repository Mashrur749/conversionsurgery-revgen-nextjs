'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, AlertCircle, CheckCircle } from 'lucide-react';

interface Client {
  id: string;
  businessName: string;
  ownerEmail: string;
  status: string;
}

interface Props {
  variantId: string;
  variantName: string;
  templateType: string;
  clientsAlreadyUsing: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function RolloutModal({
  variantId,
  variantName,
  templateType,
  clientsAlreadyUsing,
  onClose,
  onSuccess,
}: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch('/api/admin/clients');
        if (!response.ok) throw new Error('Failed to fetch clients');
        const result = (await response.json()) as { clients: Client[] };
        setClients(result.clients || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load clients');
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  const handleAssign = async () => {
    if (selectedClients.size === 0) {
      setError('Please select at least one client');
      return;
    }

    try {
      setAssigning(true);
      setError(null);

      const responses = await Promise.all(
        Array.from(selectedClients).map((clientId) =>
          fetch('/api/admin/templates/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId,
              templateVariantId: variantId,
              templateType,
            }),
          })
        )
      );

      const allSuccessful = responses.every((r) => r.ok);
      if (!allSuccessful) {
        throw new Error('Some assignments failed');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <Card className="w-full max-w-md p-6 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-[#3D7A50]" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">Success!</h3>
          <p className="mt-2 text-muted-foreground">
            {selectedClients.size} client{selectedClients.size !== 1 ? 's' : ''} updated
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-2xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Roll Out Template Variant</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-6 space-y-2 rounded-lg bg-sage-light p-4">
          <p className="text-sm font-medium text-forest">
            Assigning <strong>{variantName}</strong> to selected clients
          </p>
          <p className="text-xs text-forest">{clientsAlreadyUsing} client(s) already using this variant</p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-destructive/30 bg-[#FDEAE4] p-4">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-sienna">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : (
          <div className="mb-6 max-h-96 space-y-2 overflow-y-auto">
            {clients.map((client) => (
              <label
                key={client.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-[#F8F9FA]"
              >
                <input
                  type="checkbox"
                  checked={selectedClients.has(client.id)}
                  onChange={(e) => {
                    const newSelected = new Set(selectedClients);
                    if (e.target.checked) {
                      newSelected.add(client.id);
                    } else {
                      newSelected.delete(client.id);
                    }
                    setSelectedClients(newSelected);
                  }}
                  className="h-4 w-4 rounded border-border"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{client.businessName}</p>
                  <p className="text-xs text-muted-foreground">{client.ownerEmail}</p>
                </div>
                <Badge variant={client.status === 'active' ? 'default' : 'outline'}>
                  {client.status}
                </Badge>
              </label>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-6">
          <p className="text-sm font-medium text-foreground">
            {selectedClients.size} client{selectedClients.size !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-3">
            <Button onClick={onClose} variant="outline" disabled={assigning}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={assigning || selectedClients.size === 0}>
              {assigning ? 'Assigning...' : 'Assign to Clients'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
