'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw } from 'lucide-react';

interface Props {
  clientId: string;
  clientName: string;
  status: string | null;
}

export function DeleteButton({ clientId, clientName, status }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const isCancelled = status === 'cancelled';

  async function handleAction() {
    setIsLoading(true);
    setError('');

    try {
      const newStatus = isCancelled ? 'active' : 'cancelled';

      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error || `Failed to ${isCancelled ? 'reactivate' : 'delete'} client`);
        setIsLoading(false);
        return;
      }

      router.refresh();
      setShowConfirm(false);
    } catch (err) {
      console.error('Action error:', err);
      setError(`Failed to ${isCancelled ? 'reactivate' : 'delete'} client`);
      setIsLoading(false);
    }
  }

  if (showConfirm) {
    if (isCancelled) {
      return (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-100 rounded">
              {error}
            </div>
          )}
          <div>
            <p className="font-semibold text-sm">Reactivate {clientName}?</p>
            <p className="text-sm text-muted-foreground mt-2">
              This will restore the client to active status. They will resume receiving calls
              and messages.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirm(false);
                setError('');
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? 'Reactivating...' : 'Reactivate Client'}
            </Button>
          </div>
        </div>
      );
    }

    // Delete confirmation
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-100 rounded">
            {error}
          </div>
        )}
        <div>
          <p className="font-semibold text-sm">Delete {clientName}?</p>
          <p className="text-sm text-muted-foreground mt-2">
            This will mark the client as cancelled. They will no longer receive calls or
            messages. You can reactivate them later if needed.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setShowConfirm(false);
              setError('');
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleAction}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete Client'}
          </Button>
        </div>
      </div>
    );
  }

  // Reactivate button for cancelled clients
  if (isCancelled) {
    return (
      <Button
        variant="outline"
        className="w-full border-blue-200 text-blue-600 hover:bg-blue-50"
        onClick={() => setShowConfirm(true)}
        disabled={isLoading}
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        Reactivate Client
      </Button>
    );
  }

  // Delete button for active/pending clients
  return (
    <Button
      variant="destructive"
      className="w-full"
      onClick={() => setShowConfirm(true)}
      disabled={isLoading}
    >
      <Trash2 className="w-4 h-4 mr-2" />
      Delete Client
    </Button>
  );
}
