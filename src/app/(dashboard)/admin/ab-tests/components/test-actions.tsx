'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface Props {
  testId: string;
  status: string;
  winner: string | null;
}

export function TestActions({ testId, status, winner }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAction = async (action: 'pause' | 'resume' | 'complete') => {
    setIsLoading(true);
    setError('');

    try {
      const newStatus =
        action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'completed';

      const res = await fetch(`/api/admin/ab-tests/${testId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          endDate: action === 'complete' ? new Date().toISOString() : undefined,
        }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok) {
        setError(data.error || 'Failed to update test');
        setIsLoading(false);
        return;
      }

      router.refresh();
      setIsLoading(false);
    } catch (err: any) {
      console.error('Action error:', err);
      setError(err.message || 'Failed to update test');
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-[#FDEAE4] rounded-lg">
              {error}
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-3">Test Actions</h3>
            <div className="flex gap-2 flex-wrap">
              {status === 'active' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleAction('pause')}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Pause Test
                  </Button>
                  <Button
                    onClick={() => handleAction('complete')}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Complete Test
                  </Button>
                </>
              )}

              {status === 'paused' && (
                <>
                  <Button
                    onClick={() => handleAction('resume')}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Resume Test
                  </Button>
                  <Button
                    onClick={() => handleAction('complete')}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Complete Test
                  </Button>
                </>
              )}

              {status === 'completed' && (
                <div className="text-sm text-muted-foreground">
                  Test is complete. Results are finalized{' '}
                  {winner && `with ${winner} as the winner`}.
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
