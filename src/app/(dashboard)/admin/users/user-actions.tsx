'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';

interface User {
  id: string;
  email: string | null;
  hasAgencyAccess: boolean;
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

export function UserActions({ user }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {user.hasAgencyAccess && (
          <DropdownMenuItem asChild>
            <Link href="/admin/team">Manage Agency Team</Link>
          </DropdownMenuItem>
        )}
        {user.clientId && (
          <DropdownMenuItem asChild>
            <Link href={`/admin/clients/${user.clientId}/team`}>Manage Client Team</Link>
          </DropdownMenuItem>
        )}
        {!user.hasAgencyAccess && !user.clientId && (
          <DropdownMenuItem disabled>
            No team membership
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
