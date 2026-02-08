'use client';

import { useSession } from 'next-auth/react';
import { useAdminContext } from '@/lib/admin-context';
import { useEffect, useState } from 'react';
import { getDb } from '@/db';
import { clients } from '@/db/schema/clients';

export function ClientSelector() {
  const { data: session } = useSession();
  const { selectedClientId, setSelectedClientId, isAdmin, setIsAdmin } = useAdminContext();
  const [availableClients, setAvailableClients] = useState<Array<{ id: string; businessName: string }>>([]);
  const [loading, setLoading] = useState(false);

  // Set isAdmin based on session
  useEffect(() => {
    if (session?.user?.isAdmin) {
      setIsAdmin(true);
    }
  }, [session, setIsAdmin]);

  // Load available clients for admin
  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    async function loadClients() {
      try {
        setLoading(true);
        const db = getDb();
        const allClients = await db.select().from(clients);
        setAvailableClients(allClients);

        // Set first client as default if none selected
        if (!selectedClientId && allClients.length > 0) {
          setSelectedClientId(allClients[0].id);
        }
      } catch (error) {
        console.error('Failed to load clients:', error);
      } finally {
        setLoading(false);
      }
    }

    loadClients();
  }, [isAdmin, selectedClientId, setSelectedClientId]);

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
