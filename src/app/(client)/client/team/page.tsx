'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, Trash2, Users } from 'lucide-react';

interface TeamMember {
  id: string;
  personId: string;
  isOwner: boolean;
  isActive: boolean;
  roleTemplateId: string;
  createdAt: string;
  personName: string;
  personEmail: string | null;
  personPhone: string | null;
  lastLoginAt: string | null;
  roleName: string;
  roleSlug: string;
}

interface RoleTemplate {
  id: string;
  name: string;
  slug: string;
}

export default function ClientTeamPage() {
  const { hasPermission, personId } = usePermissions();
  const canManage = hasPermission(PORTAL_PERMISSIONS.TEAM_MANAGE);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add member dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addRoleId, setAddRoleId] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/client/team');
      if (!res.ok) {
        setError('Failed to load team members');
        return;
      }
      const data = (await res.json()) as { members: TeamMember[] };
      setMembers(data.members);
    } catch {
      setError('Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/client/team/roles');
      if (res.ok) {
        const data = (await res.json()) as { roles: RoleTemplate[] };
        setRoles(data.roles);
      }
    } catch {
      // Roles will be empty, but that's acceptable for read-only users
    }
  }, []);

  useEffect(() => {
    fetchMembers();
    if (canManage) {
      fetchRoles();
    }
  }, [fetchMembers, fetchRoles, canManage]);

  async function handleAddMember() {
    if (!addName.trim()) return;
    if (!addEmail.trim() && !addPhone.trim()) {
      setAddError('Either email or phone is required');
      return;
    }
    if (!addRoleId) {
      setAddError('Please select a role');
      return;
    }

    setAddLoading(true);
    setAddError('');

    try {
      const payload: Record<string, string> = {
        name: addName.trim(),
        roleTemplateId: addRoleId,
      };
      if (addEmail.trim()) payload.email = addEmail.trim();
      if (addPhone.trim()) payload.phone = addPhone.trim();

      const res = await fetch('/api/client/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { error?: string; success?: boolean };

      if (!res.ok) {
        setAddError(data.error || 'Failed to add team member');
        setAddLoading(false);
        return;
      }

      // Reset form and close dialog
      setAddName('');
      setAddEmail('');
      setAddPhone('');
      setAddRoleId('');
      setAddOpen(false);
      fetchMembers();
    } catch {
      setAddError('Something went wrong. Please try again.');
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      const res = await fetch(`/api/client/team/${memberId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error || 'Failed to remove team member');
        return;
      }

      fetchMembers();
    } catch {
      setError('Failed to remove team member');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeMembers = members.filter((m) => m.isActive);
  const inactiveMembers = members.filter((m) => !m.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-muted-foreground">
            People who have access to this portal.
          </p>
        </div>
        {canManage && (
          <>
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="size-4 mr-2" />
            Add Team Member
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Invite someone to access this business portal. They&apos;ll be able to
                  log in with their email or phone number.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="add-name">Name</Label>
                  <Input
                    id="add-name"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="Jane Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-email">Email</Label>
                  <Input
                    id="add-email"
                    type="email"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="jane@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-phone">Phone</Label>
                  <Input
                    id="add-phone"
                    type="tel"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-role">Role</Label>
                  <Select value={addRoleId} onValueChange={setAddRoleId}>
                    <SelectTrigger id="add-role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {addError && (
                  <p role="alert" className="text-sm text-destructive">{addError}</p>
                )}
              </div>
              <DialogFooter className="justify-end">
                <Button
                  variant="outline"
                  onClick={() => setAddOpen(false)}
                  disabled={addLoading}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddMember} disabled={addLoading}>
                  {addLoading ? 'Adding...' : 'Add Member'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {activeMembers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="size-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No team members yet.
            </p>
            {canManage && (
              <p className="text-sm text-muted-foreground text-center mt-1">
                Add team members to give them access to this portal.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Members</CardTitle>
            <CardDescription>
              {activeMembers.length} {activeMembers.length === 1 ? 'person' : 'people'} with active access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeMembers.map((member) => {
                  const isYou = member.personId === personId;
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {member.personName}
                            {isYou && (
                              <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {member.personEmail || member.personPhone || 'No contact info'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.isOwner ? 'default' : 'secondary'}>
                          {member.roleName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                          Active
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          {!member.isOwner && !isYou && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                  <Trash2 className="size-4" />
                                  <span className="sr-only">Remove</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove {member.personName} from this portal?
                                    They will lose access immediately.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleRemoveMember(member.id)}
                                    variant="destructive"
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {inactiveMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inactive Members</CardTitle>
            <CardDescription>
              Previously removed team members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveMembers.map((member) => (
                  <TableRow key={member.id} className="opacity-60">
                    <TableCell>
                      <div>
                        <p className="font-medium">{member.personName}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.personEmail || member.personPhone || 'No contact info'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{member.roleName}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-gray-500 border-gray-300">
                        Inactive
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
