'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface AppointmentCompleteButtonProps {
  appointmentId: string;
}

export function AppointmentCompleteButton({
  appointmentId,
}: AppointmentCompleteButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleComplete() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/client/appointments/${appointmentId}/complete`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? 'Failed to mark appointment complete.');
        return;
      }

      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={handleComplete}
        disabled={loading}
        className="text-xs"
      >
        {loading ? 'Saving...' : 'Mark Complete'}
      </Button>
      {error && <p className="text-xs text-[#C15B2E]">{error}</p>}
    </div>
  );
}
