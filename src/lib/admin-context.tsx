'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface AdminContextType {
  selectedClientId: string | null;
  setSelectedClientId: (clientId: string | null) => void;
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  return (
    <AdminContext.Provider value={{ selectedClientId, setSelectedClientId, isAdmin, setIsAdmin }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdminContext() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdminContext must be used within an AdminProvider');
  }
  return context;
}
