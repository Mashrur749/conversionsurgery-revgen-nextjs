'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

  return (
    <>
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-100 rounded">
          {error}
        </div>
      )}

      {isCancelled ? (
        <Button
          variant="outline"
          className="w-full border-blue-200 text-blue-600 hover:bg-blue-50"
          onClick={() => setShowConfirm(true)}
          disabled={isLoading}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reactivate Client
        </Button>
      ) : (
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => setShowConfirm(true)}
          disabled={isLoading}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Client
        </Button>
      )}

      <AlertDialog open={showConfirm} onOpenChange={(open) => { setShowConfirm(open); if (!open) setError(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isCancelled ? `Reactivate ${clientName}?` : `Delete ${clientName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isCancelled
                ? 'This will restore the client to active status. They will resume receiving calls and messages.'
                : 'This will mark the client as cancelled. They will no longer receive calls or messages. You can reactivate them later if needed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={isCancelled ? 'default' : 'destructive'}
              onClick={handleAction}
              disabled={isLoading}
            >
              {isLoading
                ? (isCancelled ? 'Reactivating...' : 'Deleting...')
                : (isCancelled ? 'Reactivate Client' : 'Delete Client')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
