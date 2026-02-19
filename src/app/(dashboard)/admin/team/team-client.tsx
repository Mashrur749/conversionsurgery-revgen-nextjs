'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Crown, Plus, Search, UserX } from 'lucide-react';

interface AgencyMember {
  membershipId: string;
  personId: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  roleTemplateId: string;
  roleName: string;
  roleSlug: string;
  clientScope: string;
  isActive: boolean;
  joinedAt: string;
  assignedClients: { clientId: string; clientName: string }[] | null;
}

interface RoleOption {
  id: string;
  name: string;
  slug: string;
}

interface ClientOption {
  id: string;
  businessName: string;
}

interface AgencyTeamClientProps {
  members: AgencyMember[];
  agencyRoles: RoleOption[];
  allClients: ClientOption[];
}

export function AgencyTeamClient({ members, agencyRoles, allClients }: AgencyTeamClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editMember, setEditMember] = useState<AgencyMember | null>(null);
  const [removeMember, setRemoveMember] = useState<AgencyMember | null>(null);
  const [loading, setLoading] = useState(false);

  // Invite form state
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviteScope, setInviteScope] = useState<'all' | 'assigned'>('all');
  const [inviteClientIds, setInviteClientIds] = useState<string[]>([]);

  // Edit form state
  const [editRoleId, setEditRoleId] = useState('');
  const [editScope, setEditScope] = useState<'all' | 'assigned'>('all');
  const [editClientIds, setEditClientIds] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);

  const filteredMembers = members.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      (m.email && m.email.toLowerCase().includes(q))
    );
  });

  const nonOwnerRoles = agencyRoles.filter((r) => r.slug !== 'agency_owner');

  async function handleInvite() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inviteName,
          email: inviteEmail,
          roleTemplateId: inviteRoleId,
          clientScope: inviteScope,
          assignedClientIds: inviteScope === 'assigned' ? inviteClientIds : undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error || 'Failed to invite member');
        return;
      }

      setInviteOpen(false);
      resetInviteForm();
      router.refresh();
    } catch {
      alert('Failed to invite member');
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit() {
    if (!editMember) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/team/${editMember.membershipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleTemplateId: editRoleId,
          clientScope: editScope,
          assignedClientIds: editScope === 'assigned' ? editClientIds : undefined,
          isActive: editActive,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error || 'Failed to update member');
        return;
      }

      setEditMember(null);
      router.refresh();
    } catch {
      alert('Failed to update member');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    if (!removeMember) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/team/${removeMember.membershipId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error || 'Failed to remove member');
        return;
      }

      setRemoveMember(null);
      router.refresh();
    } catch {
      alert('Failed to remove member');
    } finally {
      setLoading(false);
    }
  }

  function openEdit(member: AgencyMember) {
    setEditMember(member);
    setEditRoleId(member.roleTemplateId);
    setEditScope(member.clientScope as 'all' | 'assigned');
    setEditClientIds(member.assignedClients?.map((c) => c.clientId) || []);
    setEditActive(member.isActive);
  }

  function resetInviteForm() {
    setInviteName('');
    setInviteEmail('');
    setInviteRoleId('');
    setInviteScope('all');
    setInviteClientIds([]);
  }

  function toggleClientId(clientId: string, list: string[], setter: (ids: string[]) => void) {
    if (list.includes(clientId)) {
      setter(list.filter((id) => id !== clientId));
    } else {
      setter([...list, clientId]);
    }
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <UserX className="size-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No team members yet</h3>
          <p className="text-muted-foreground mb-4">
            You&apos;re the only team member. Invite your first team member to delegate work.
          </p>
          <Sheet open={inviteOpen} onOpenChange={setInviteOpen}>
            <SheetTrigger asChild>
              <Button>
                <Plus className="size-4 mr-2" />
                Invite Member
              </Button>
            </SheetTrigger>
            {renderInviteSheet()}
          </Sheet>
        </CardContent>
      </Card>
    );
  }

  function renderInviteSheet() {
    return (
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Invite Team Member</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div>
            <Label htmlFor="invite-name">Name</Label>
            <Input
              id="invite-name"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>
          <div>
            <Label htmlFor="invite-role">Role</Label>
            <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
              <SelectTrigger id="invite-role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {nonOwnerRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="invite-scope">Client Access</Label>
            <Select
              value={inviteScope}
              onValueChange={(v) => setInviteScope(v as 'all' | 'assigned')}
            >
              <SelectTrigger id="invite-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                <SelectItem value="assigned">Specific clients</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {inviteScope === 'assigned' && (
            <div>
              <Label>Select Clients</Label>
              <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1 mt-1">
                {allClients.map((client) => (
                  <label
                    key={client.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={inviteClientIds.includes(client.id)}
                      onCheckedChange={() =>
                        toggleClientId(client.id, inviteClientIds, setInviteClientIds)
                      }
                    />
                    {client.businessName}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setInviteOpen(false);
                resetInviteForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={!inviteName || !inviteEmail || !inviteRoleId || loading}
            >
              {loading ? 'Inviting...' : 'Send Invite'}
            </Button>
          </div>
        </div>
      </SheetContent>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-80"
            />
          </div>
          <Sheet open={inviteOpen} onOpenChange={setInviteOpen}>
            <SheetTrigger asChild>
              <Button>
                <Plus className="size-4 mr-2" />
                Invite Member
              </Button>
            </SheetTrigger>
            {renderInviteSheet()}
          </Sheet>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Client Access</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => {
                  const isOwner = member.roleSlug === 'agency_owner';
                  return (
                    <TableRow key={member.membershipId}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {member.name}
                          {isOwner && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Crown className="size-4 text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent>Agency Owner</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.email || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{member.roleName}</Badge>
                      </TableCell>
                      <TableCell>
                        {member.clientScope === 'all' ? (
                          'All clients'
                        ) : (
                          <Tooltip>
                            <TooltipTrigger className="cursor-default">
                              {member.assignedClients?.length || 0} client
                              {(member.assignedClients?.length || 0) !== 1 ? 's' : ''}
                            </TooltipTrigger>
                            <TooltipContent>
                              {member.assignedClients
                                ?.map((c) => c.clientName)
                                .join(', ') || 'None assigned'}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={member.isActive ? 'default' : 'secondary'}
                          className={
                            member.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-100'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
                          }
                        >
                          {member.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isOwner ? (
                          <span className="text-xs text-muted-foreground">Owner</span>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(member)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setRemoveMember(member)}
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredMembers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No members match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editMember} onOpenChange={(open) => !open && setEditMember(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {editMember?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Role</Label>
                <Select value={editRoleId} onValueChange={setEditRoleId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {nonOwnerRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editRoleId !== editMember?.roleTemplateId && (
                  <p className="text-sm text-amber-600 mt-1">
                    Changing {editMember?.name}&apos;s role will update their permissions and log them out.
                  </p>
                )}
              </div>
              <div>
                <Label>Client Access</Label>
                <Select
                  value={editScope}
                  onValueChange={(v) => setEditScope(v as 'all' | 'assigned')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All clients</SelectItem>
                    <SelectItem value="assigned">Specific clients</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editScope === 'assigned' && (
                <div>
                  <Label>Select Clients</Label>
                  <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1 mt-1">
                    {allClients.map((client) => (
                      <label
                        key={client.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={editClientIds.includes(client.id)}
                          onCheckedChange={() =>
                            toggleClientId(client.id, editClientIds, setEditClientIds)
                          }
                        />
                        {client.businessName}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-active"
                  checked={editActive}
                  onCheckedChange={(checked) => setEditActive(checked === true)}
                />
                <Label htmlFor="edit-active">Active</Label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditMember(null)}>
                  Cancel
                </Button>
                <Button onClick={handleEdit} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Remove Confirmation */}
        <AlertDialog open={!!removeMember} onOpenChange={(open) => !open && setRemoveMember(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {removeMember?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Remove {removeMember?.name} from the agency team? They will lose all dashboard
                access immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemove}
                className="bg-red-600 hover:bg-red-700"
                disabled={loading}
              >
                {loading ? 'Removing...' : 'Remove'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
