'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, ExternalLink, Unplug } from 'lucide-react';

interface Props {
  clientId: string;
  status: 'connected' | 'expired' | 'not_connected';
  accountId?: string | null;
}

export function GoogleConnectionCard({ clientId, status, accountId }: Props) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google Business Profile? Review auto-responses will stop working.')) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/google`, { method: 'DELETE' });
      if (res.ok) {
        setCurrentStatus('not_connected');
      }
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
    setDisconnecting(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Google Business Profile</CardTitle>
        {currentStatus === 'connected' && (
          <Badge variant="outline" className="bg-green-50 text-green-700">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        )}
        {currentStatus === 'expired' && (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
            <AlertCircle className="h-3 w-3 mr-1" />
            Token Expired
          </Badge>
        )}
        {currentStatus === 'not_connected' && (
          <Badge variant="outline" className="bg-gray-50 text-gray-600">
            Not Connected
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {currentStatus === 'not_connected' ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect a Google Business Profile to enable auto-posting review responses.
            </p>
            <Button asChild>
              <a href={`/api/admin/clients/${clientId}/google`}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Connect Google
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {accountId && (
              <p className="text-sm text-muted-foreground">
                Account: <span className="font-mono text-xs">{accountId}</span>
              </p>
            )}
            {currentStatus === 'expired' && (
              <div className="space-y-2">
                <p className="text-sm text-yellow-700">
                  OAuth token has expired. Reconnect to restore review response posting.
                </p>
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/admin/clients/${clientId}/google`}>
                    Reconnect
                  </a>
                </Button>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              <Unplug className="h-4 w-4 mr-2" />
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
