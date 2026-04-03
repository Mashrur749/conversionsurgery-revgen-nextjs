'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
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

  if (clients.length === 0) {
    return (
      <Link
        href="/admin/clients/new"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-forest-light text-white/80 hover:text-white transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Add first client
      </Link>
    );
  }

  return (
    <Select
      value={selectedClientId || ''}
      onValueChange={(value) => setSelectedClientId(value || null)}
    >
      <SelectTrigger className="w-[180px] text-sm bg-forest-light border-forest-light text-white [&>svg]:text-white/70">
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
