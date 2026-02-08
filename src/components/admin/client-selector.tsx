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
import { Badge } from '@/components/ui/badge';

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
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
        Admin
      </Badge>
      <Select
        value={selectedClientId || ''}
        onValueChange={(value) => setSelectedClientId(value || null)}
      >
        <SelectTrigger className="w-[220px]">
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
    </div>
  );
}
