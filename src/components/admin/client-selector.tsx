'use client';

import { useEffect } from 'react';
import { useAdmin } from '@/lib/admin-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Client {
  id: string;
  businessName: string;
  ownerName: string;
}

interface Props {
  clients: Client[];
}

export function ClientSelector({ clients }: Props) {
  const { selectedClientId, setSelectedClientId, setClients } = useAdmin();

  useEffect(() => {
    setClients(clients);
    if (!selectedClientId && clients.length > 0) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId, setClients, setSelectedClientId]);

  return (
    <Select
      value={selectedClientId || ''}
      onValueChange={(value) => setSelectedClientId(value || null)}
    >
      <SelectTrigger className="w-[180px] text-sm">
        <SelectValue placeholder="Select client..." />
      </SelectTrigger>
      <SelectContent>
        {clients.map((client) => (
          <SelectItem key={client.id} value={client.id}>
            {client.businessName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
