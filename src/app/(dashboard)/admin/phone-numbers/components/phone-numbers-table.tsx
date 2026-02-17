'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { Phone, ArrowRight, Loader2 } from 'lucide-react';
import type { Client } from '@/db/schema/clients';

interface ClientWithStats extends Client {
  messagesSent?: number;
  missedCallsCaptured?: number;
}

interface Props {
  clients: ClientWithStats[];
  unassignedClients: Client[];
}

export function PhoneNumbersTable({ clients, unassignedClients }: Props) {
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleReassign = async () => {
    if (!selectedNumber || !selectedClient) {
      setError('Please select both a number and a client');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/phone-numbers/reassign', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: selectedNumber,
          targetClientId: selectedClient,
        }),
      });

      const data = (await res.json()) as { error?: string; message?: string };

      if (!res.ok) {
        setError(data.error || 'Failed to reassign number');
        setIsLoading(false);
        return;
      }

      setSuccess(data.message || 'Number reassigned successfully');
      setSelectedNumber(null);
      setSelectedClient('');

      // Refresh page
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error('Reassign error:', err);
      setError(err.message || 'Failed to reassign number');
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Phone Numbers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0 divide-y">
            {clients.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No phone numbers assigned yet. Purchase your first number to get
                started.
              </div>
            ) : (
              clients.map((client) => (
                <div key={client.id} className="p-4 hover:bg-[#F8F9FA] transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Phone className="w-5 h-5 text-forest" />
                        <p className="font-mono font-semibold text-lg">
                          {formatPhoneNumber(client.twilioNumber!)}
                        </p>
                      </div>
                      <p className="text-sm font-medium mb-1">
                        {client.businessName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {client.email}
                      </p>
                    </div>

                    <div className="text-right ml-4">
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Messages Today
                          </p>
                          <p className="font-semibold">
                            {client.messagesSent || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Missed Calls
                          </p>
                          <p className="font-semibold">
                            {client.missedCallsCaptured || 0}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedNumber(client.twilioNumber!)}
                      >
                        <ArrowRight className="w-4 h-4 mr-1" />
                        Reassign
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reassign Dialog */}
      <Dialog
        open={!!selectedNumber}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedNumber(null);
            setSelectedClient('');
            setError('');
            setSuccess('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Phone Number</DialogTitle>
            <DialogDescription>
              Move {selectedNumber && formatPhoneNumber(selectedNumber)} to a
              different client
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-[#FDEAE4] rounded-md">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 text-sm text-[#3D7A50] bg-[#E8F5E9] rounded-md">
                {success}
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">
                Assign to Client
              </label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedClients.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No available clients
                    </div>
                  ) : (
                    unassignedClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.businessName}
                        {client.status === 'pending' && ' (Pending)'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                {unassignedClients.length} clients available for assignment
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedNumber(null);
                setSelectedClient('');
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReassign}
              disabled={!selectedClient || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Reassigning...
                </>
              ) : (
                'Reassign Number'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
