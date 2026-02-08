'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Client {
  id: string;
  businessName: string;
  ownerName: string;
}

interface AdminContextType {
  selectedClientId: string | null;
  selectedClient: Client | null;
  setSelectedClientId: (id: string | null) => void;
  clients: Client[];
  setClients: (clients: Client[]) => void;
  isLoading: boolean;
}

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [selectedClientId, setSelectedClientIdState] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('adminSelectedClientId');
    if (stored) {
      setSelectedClientIdState(stored);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (selectedClientId && clients.length > 0) {
      const client = clients.find(c => c.id === selectedClientId);
      setSelectedClient(client || null);
    } else {
      setSelectedClient(null);
    }
  }, [selectedClientId, clients]);

  const setSelectedClientId = (id: string | null) => {
    setSelectedClientIdState(id);
    if (id) {
      localStorage.setItem('adminSelectedClientId', id);
      document.cookie = `adminSelectedClientId=${id}; path=/; max-age=31536000`;
    } else {
      localStorage.removeItem('adminSelectedClientId');
      document.cookie = 'adminSelectedClientId=; path=/; max-age=0';
    }
  };

  return (
    <AdminContext.Provider value={{
      selectedClientId,
      selectedClient,
      setSelectedClientId,
      clients,
      setClients,
      isLoading,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
}
