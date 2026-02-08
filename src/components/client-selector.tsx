'use client';

import { useSession } from 'next-auth/react';
import { useAdmin } from '@/lib/admin-context';
import { useEffect, useState } from 'react';

export function ClientSelector() {
  const { data: session } = useSession();
  const { selectedClientId, setSelectedClientId } = useAdmin();
  const [availableClients, setAvailableClients] = useState<Array<{ id: string; businessName: string }>>([]);
  const [loading, setLoading] = useState(false);

  const isAdmin = session?.user?.isAdmin || false;

  // Load available clients for admin
  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    async function loadClients() {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/clients');
        if (res.ok) {
          const data = await res.json();
          setAvailableClients(data.clients || data);
        }
      } catch (error) {
        console.error('Failed to load clients:', error);
      } finally {
        setLoading(false);
      }
    }

    loadClients();
  }, [isAdmin]);

  // Don't show selector if not admin
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="mb-4">
      <label htmlFor="client-select" className="block text-sm font-medium text-gray-700 mb-2">
        Select Client
      </label>
      <select
        id="client-select"
        value={selectedClientId || ''}
        onChange={(e) => setSelectedClientId(e.target.value || null)}
        disabled={loading}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">-- Select a client --</option>
        {availableClients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.businessName}
          </option>
        ))}
      </select>
    </div>
  );
}
