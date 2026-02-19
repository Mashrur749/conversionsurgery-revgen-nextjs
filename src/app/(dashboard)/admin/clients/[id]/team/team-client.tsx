'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, Crown, Plus, UserPlus, Users } from 'lucide-react';

interface PermissionOverrides {
  grant?: string[];
  revoke?: string[];
}

interface ClientMember {
  membershipId: string;
  personId: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  roleTemplateId: string;
  roleName: string;
  roleSlug: string;
  rolePermissions: string[];
  permissionOverrides: PermissionOverrides | null;
  isOwner: boolean;
  receiveEscalations: boolean;
  receiveHotTransfers: boolean;
  priority: number;
  isActive: boolean;
  joinedAt: string;
}

interface RoleOption {
  id: string;
  name: string;
  slug: string;
  permissions: string[];
}

interface ClientTeamClientProps {
  clientId: string;
  clientName: string;
  members: ClientMember[];
  clientRoles: RoleOption[];
  allPortalPermissions: string[];
}

function countEffectivePermissions(
  rolePermissions: string[],
  overrides: PermissionOverrides | null,
  totalPermissions: number
): { count: number; total: number } {
  const effective = new Set(rolePermissions);
  if (overrides?.grant) {
    for (const p of overrides.grant) effective.add(p);
  }
  if (overrides?.revoke) {
    for (const p of overrides.revoke) effective.delete(p);
  }
  return { count: effective.size, total: totalPermissions };
}

export function ClientTeamClient({
  clientId,
  clientName,
  members,
  clientRoles,
  allPortalPermissions,
}: ClientTeamClientProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editMember, setEditMember] = useState<ClientMember | null>(null);
  const [removeMember, setRemoveMember] = useState<ClientMember | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Add member form state
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addRoleId, setAddRoleId] = useState('');
  const [addEscalations, setAddEscalations] = useState(false);
  const [addHotTransfers, setAddHotTransfers] = useState(false);
  const [addPriority, setAddPriority] = useState(1);

  // Edit form state
  const [editRoleId, setEditRoleId] = useState('');
  const [editEscalations, setEditEscalations] = useState(false);
  const [editHotTransfers, setEditHotTransfers] = useState(false);
  const [editPriority, setEditPriority] = useState(1);
  const [editActive, setEditActive] = useState(true);

  // Transfer ownership state
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferConfirmName, setTransferConfirmName] = useState('');

  const owner = members.find((m) => m.isOwner);
  const teamMembers = members.filter((m) => !m.isOwner);
  const nonOwnerRoles = clientRoles.filter((r) => r.slug !== 'business_owner');
  const activeNonOwnerMembers = teamMembers.filter((m) => m.isActive);

  const targetMember = activeNonOwnerMembers.find(
    (m) => m.membershipId === transferTargetId
  );

  async function handleAddMember() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addName,
          email: addEmail || undefined,
          phone: addPhone || undefined,
          roleTemplateId: addRoleId,
          receiveEscalations: addEscalations,
          receiveHotTransfers: addHotTransfers,
          priority: addPriority,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error || 'Failed to add member');
        return;
      }

      setAddOpen(false);
      resetAddForm();
      router.refresh();
    } catch {
      alert('Failed to add member');
    } finally {
      setLoading(false);
    }
  }

  async function handleEditMember() {
    if (!editMember) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/team/${editMember.membershipId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roleTemplateId: editRoleId,
            receiveEscalations: editEscalations,
            receiveHotTransfers: editHotTransfers,
            priority: editPriority,
            isActive: editActive,
          }),
        }
      );

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

  async function handleRemoveMember() {
    if (!removeMember) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/team/${removeMember.membershipId}`,
        { method: 'DELETE' }
      );

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

  async function handleTransferOwnership() {
    if (!transferTargetId || !targetMember) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/team/transfer-ownership`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetMembershipId: transferTargetId,
            confirmName: transferConfirmName,
          }),
        }
      );

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error || 'Failed to transfer ownership');
        return;
      }

      setTransferOpen(false);
      setTransferTargetId('');
      setTransferConfirmName('');
      router.refresh();
    } catch {
      alert('Failed to transfer ownership');
    } finally {
      setLoading(false);
    }
  }

  function openEdit(member: ClientMember) {
    setEditMember(member);
    setEditRoleId(member.roleTemplateId);
    setEditEscalations(member.receiveEscalations);
    setEditHotTransfers(member.receiveHotTransfers);
    setEditPriority(member.priority);
    setEditActive(member.isActive);
  }

  function resetAddForm() {
    setAddName('');
    setAddEmail('');
    setAddPhone('');
    setAddRoleId('');
    setAddEscalations(false);
    setAddHotTransfers(false);
    setAddPriority(1);
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Owner Section */}
        {owner && (
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Crown className="size-4 text-amber-500" />
                Business Owner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{owner.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {owner.email || owner.phone || '-'}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">{owner.roleName}</Badge>
                    <span className="text-xs text-muted-foreground">
                      Full access ({owner.rolePermissions.length} permissions)
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTransferOpen(true)}
                  disabled={activeNonOwnerMembers.length === 0}
                >
                  Transfer Ownership
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team Members Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Team Members</h2>
            <Sheet open={addOpen} onOpenChange={setAddOpen}>
              <SheetTrigger asChild>
                <Button>
                  <Plus className="size-4 mr-2" />
                  Add Team Member
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Add Team Member</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 mt-6">
                  <div>
                    <Label htmlFor="add-name">Name</Label>
                    <Input
                      id="add-name"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="add-email">Email</Label>
                    <Input
                      id="add-email"
                      type="email"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="add-phone">Phone (optional)</Label>
                    <Input
                      id="add-phone"
                      value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select value={addRoleId} onValueChange={setAddRoleId}>
                      <SelectTrigger>
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

                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                      <ChevronDown className="size-4" />
                      Escalation Settings
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 mt-3 pl-6">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="add-escalations">Receive Escalations</Label>
                        <Switch
                          id="add-escalations"
                          checked={addEscalations}
                          onCheckedChange={setAddEscalations}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="add-hot-transfers">Receive Hot Transfers</Label>
                        <Switch
                          id="add-hot-transfers"
                          checked={addHotTransfers}
                          onCheckedChange={setAddHotTransfers}
                        />
                      </div>
                      <div>
                        <Label htmlFor="add-priority">Priority (1-10)</Label>
                        <Input
                          id="add-priority"
                          type="number"
                          min={1}
                          max={10}
                          value={addPriority}
                          onChange={(e) => setAddPriority(parseInt(e.target.value, 10) || 1)}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAddOpen(false);
                        resetAddForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddMember}
                      disabled={!addName || (!addEmail && !addPhone) || !addRoleId || loading}
                    >
                      {loading ? 'Adding...' : 'Add Member'}
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {teamMembers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="size-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No team members yet</h3>
                <p className="text-muted-foreground mb-4">
                  Only the business owner has portal access. Add team members to give their
                  staff access to leads, conversations, and analytics.
                </p>
                <Button onClick={() => setAddOpen(true)}>
                  <UserPlus className="size-4 mr-2" />
                  Add Team Member
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member) => {
                      const { count, total } = countEffectivePermissions(
                        member.rolePermissions,
                        member.permissionOverrides,
                        allPortalPermissions.length
                      );

                      return (
                        <TableRow key={member.membershipId}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {member.email || member.phone || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{member.roleName}</Badge>
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
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger className="cursor-default">
                                {count}/{total}
                              </TooltipTrigger>
                              <TooltipContent>
                                {count} of {total} portal permissions
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="text-right">
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
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Edit Member Dialog */}
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
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-medium">Escalation Settings</Label>
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-escalations" className="font-normal">
                    Receive Escalations
                  </Label>
                  <Switch
                    id="edit-escalations"
                    checked={editEscalations}
                    onCheckedChange={setEditEscalations}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-hot-transfers" className="font-normal">
                    Receive Hot Transfers
                  </Label>
                  <Switch
                    id="edit-hot-transfers"
                    checked={editHotTransfers}
                    onCheckedChange={setEditHotTransfers}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-priority">Priority (1-10)</Label>
                  <Input
                    id="edit-priority"
                    type="number"
                    min={1}
                    max={10}
                    value={editPriority}
                    onChange={(e) => setEditPriority(parseInt(e.target.value, 10) || 1)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-member-active"
                  checked={editActive}
                  onCheckedChange={(checked) => setEditActive(checked === true)}
                />
                <Label htmlFor="edit-member-active">Active</Label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditMember(null)}>
                  Cancel
                </Button>
                <Button onClick={handleEditMember} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Remove Member Confirmation */}
        <AlertDialog
          open={!!removeMember}
          onOpenChange={(open) => !open && setRemoveMember(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {removeMember?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Remove {removeMember?.name}&apos;s access to {clientName}? They will be logged
                out immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveMember}
                className="bg-red-600 hover:bg-red-700"
                disabled={loading}
              >
                {loading ? 'Removing...' : 'Remove'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Transfer Ownership Dialog */}
        <AlertDialog
          open={transferOpen}
          onOpenChange={(open) => {
            if (!open) {
              setTransferOpen(false);
              setTransferTargetId('');
              setTransferConfirmName('');
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Transfer Business Ownership</AlertDialogTitle>
              <AlertDialogDescription>
                This will transfer business ownership of {clientName} to another member.
                The current owner will be downgraded to Office Manager.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Select New Owner</Label>
                <Select value={transferTargetId} onValueChange={setTransferTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeNonOwnerMembers.map((member) => (
                      <SelectItem key={member.membershipId} value={member.membershipId}>
                        {member.name} ({member.email || member.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {targetMember && (
                <div>
                  <Label htmlFor="transfer-confirm">
                    Type &quot;{targetMember.name}&quot; to confirm
                  </Label>
                  <Input
                    id="transfer-confirm"
                    value={transferConfirmName}
                    onChange={(e) => setTransferConfirmName(e.target.value)}
                    placeholder={targetMember.name}
                  />
                </div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleTransferOwnership}
                disabled={
                  !transferTargetId ||
                  !targetMember ||
                  transferConfirmName !== targetMember?.name ||
                  loading
                }
                className="bg-amber-600 hover:bg-amber-700"
              >
                {loading ? 'Transferring...' : 'Transfer Ownership'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
