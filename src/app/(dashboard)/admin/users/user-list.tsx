'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { format } from 'date-fns';
import { UserActions } from './user-actions';

interface User {
  id: string;
  name: string | null;
  email: string | null;
  isAdmin: boolean | null;
  clientId: string | null;
  clientName: string | null;
  createdAt: Date | null;
}

interface Client {
  id: string;
  businessName: string;
}

interface Props {
  users: User[];
  clients: Client[];
  currentUserId: string;
}

export function UserList({ users, clients, currentUserId }: Props) {
  const [search, setSearch] = useState('');

  const filtered = users.filter((user) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (user.name?.toLowerCase().includes(q)) ||
      (user.email?.toLowerCase().includes(q)) ||
      (user.clientName?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="divide-y">
        {filtered.map((user) => (
          <div key={user.id} className="flex items-center justify-between p-4 hover:bg-[#F8F9FA] transition-colors">
            <div>
              <p className="font-medium">{user.name || 'No name'}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              {user.clientName && (
                <p className="text-xs text-muted-foreground">
                  &rarr; {user.clientName}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : '\u2014'}
              </span>
              {user.isAdmin && (
                <Badge className="bg-[#FFF3E0] text-forest">Admin</Badge>
              )}
              <UserActions
                user={user}
                clients={clients}
                currentUserId={currentUserId}
              />
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            {search ? 'No users match your search.' : 'No users found.'}
          </div>
        )}
      </div>
    </div>
  );
}
