'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface User {
  id: string;
  email: string | null;
  isAdmin: boolean | null;
  clientId: string | null;
}

interface Client {
  id: string;
  businessName: string;
}

interface Props {
  user: User;
  clients: Client[];
  currentUserId: string;
}

export function UserActions({ user, clients, currentUserId }: Props) {
  const router = useRouter();
  const [showAssign, setShowAssign] = useState(false);
  const [showToggleAdmin, setShowToggleAdmin] = useState(false);
  const [selectedClient, setSelectedClient] = useState(user.clientId || 'none');
  const [loading, setLoading] = useState(false);

  const isCurrentUser = user.id === currentUserId;

  async function toggleAdmin() {
    setLoading(true);
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAdmin: !user.isAdmin }),
    });
    setLoading(false);
    setShowToggleAdmin(false);
    router.refresh();
  }

  async function assignClient() {
    setLoading(true);
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: selectedClient === 'none' ? null : selectedClient }),
    });
    setLoading(false);
    setShowAssign(false);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowAssign(true)}>
            Assign to Client
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowToggleAdmin(true)}
            disabled={isCurrentUser || loading}
            className={user.isAdmin ? 'text-red-600' : ''}
          >
            {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Select Client</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="No client (admin only)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No client (admin only)</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.businessName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={assignClient} disabled={loading}>
                {loading ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="outline" onClick={() => setShowAssign(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showToggleAdmin} onOpenChange={setShowToggleAdmin}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {user.isAdmin ? 'Remove Admin Access' : 'Grant Admin Access'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {user.isAdmin
                ? `This will remove admin privileges from ${user.email}. They will lose access to all admin features.`
                : `This will grant admin privileges to ${user.email}. They will have full access to all admin features.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={user.isAdmin ? 'destructive' : 'default'}
              onClick={toggleAdmin}
              disabled={loading}
            >
              {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
