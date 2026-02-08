'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface Props {
  clientId: string;
  clientName: string;
}

export function DeleteButton({ clientId, clientName }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleDelete() {
    setIsDeleting(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error || 'Failed to delete client');
        setIsDeleting(false);
        return;
      }

      // Redirect to client list
      router.push('/admin/clients');
      router.refresh();
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete client');
      setIsDeleting(false);
    }
  }

  if (showConfirm) {
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
            messages.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setShowConfirm(false);
              setError('');
            }}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Client'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="destructive"
      className="w-full"
      onClick={() => setShowConfirm(true)}
      disabled={isDeleting}
    >
      <Trash2 className="w-4 h-4 mr-2" />
      Delete Client
    </Button>
  );
}
