'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, Lock, Plus, Shield, Trash2 } from 'lucide-react';

// Permission groupings for display
const AGENCY_PERMISSION_GROUPS: Record<string, { label: string; permissions: { key: string; label: string }[] }> = {
  clients: {
    label: 'Clients',
    permissions: [
      { key: 'agency.clients.view', label: 'View clients' },
      { key: 'agency.clients.create', label: 'Create clients' },
      { key: 'agency.clients.edit', label: 'Edit clients' },
      { key: 'agency.clients.delete', label: 'Delete clients' },
    ],
  },
  conversations: {
    label: 'Conversations',
    permissions: [
      { key: 'agency.conversations.view', label: 'View conversations' },
      { key: 'agency.conversations.respond', label: 'Respond to conversations' },
    ],
  },
  flows: {
    label: 'Flows & Templates',
    permissions: [
      { key: 'agency.flows.view', label: 'View flows' },
      { key: 'agency.flows.edit', label: 'Edit flows' },
      { key: 'agency.templates.edit', label: 'Edit templates' },
    ],
  },
  content: {
    label: 'Content & AI',
    permissions: [
      { key: 'agency.knowledge.edit', label: 'Edit knowledge base' },
      { key: 'agency.ai.edit', label: 'Edit AI settings' },
    ],
  },
  analytics: {
    label: 'Analytics & Testing',
    permissions: [
      { key: 'agency.analytics.view', label: 'View analytics' },
      { key: 'agency.abtests.manage', label: 'Manage A/B tests' },
    ],
  },
  billing: {
    label: 'Billing',
    permissions: [
      { key: 'agency.billing.view', label: 'View billing' },
      { key: 'agency.billing.manage', label: 'Manage billing' },
    ],
  },
  admin: {
    label: 'Administration',
    permissions: [
      { key: 'agency.team.manage', label: 'Manage team' },
      { key: 'agency.settings.manage', label: 'Manage settings' },
      { key: 'agency.phones.manage', label: 'Manage phone numbers' },
    ],
  },
};

const CLIENT_PERMISSION_GROUPS: Record<string, { label: string; permissions: { key: string; label: string }[] }> = {
  dashboard: {
    label: 'Dashboard',
    permissions: [
      { key: 'portal.dashboard', label: 'View dashboard' },
    ],
  },
  leads: {
    label: 'Leads',
    permissions: [
      { key: 'portal.leads.view', label: 'View leads' },
      { key: 'portal.leads.edit', label: 'Edit leads' },
    ],
  },
  conversations: {
    label: 'Conversations',
    permissions: [
      { key: 'portal.conversations.view', label: 'View conversations' },
    ],
  },
  analytics: {
    label: 'Analytics & Revenue',
    permissions: [
      { key: 'portal.analytics.view', label: 'View analytics' },
      { key: 'portal.revenue.view', label: 'View revenue' },
    ],
  },
  content: {
    label: 'Content',
    permissions: [
      { key: 'portal.knowledge.view', label: 'View knowledge base' },
      { key: 'portal.knowledge.edit', label: 'Edit knowledge base' },
      { key: 'portal.reviews.view', label: 'View reviews' },
    ],
  },
  team: {
    label: 'Team',
    permissions: [
      { key: 'portal.team.view', label: 'View team' },
      { key: 'portal.team.manage', label: 'Manage team' },
    ],
  },
  settings: {
    label: 'Settings',
    permissions: [
      { key: 'portal.settings.view', label: 'View settings' },
      { key: 'portal.settings.edit', label: 'Edit settings' },
      { key: 'portal.settings.ai', label: 'AI settings' },
    ],
  },
};

interface RoleTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  scope: string;
  permissions: string[];
  isBuiltIn: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface RolesClientProps {
  templates: RoleTemplate[];
  userPermissions: string[];
}

export function RolesClient({ templates, userPermissions }: RolesClientProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewTemplate, setViewTemplate] = useState<RoleTemplate | null>(null);
  const [editTemplate, setEditTemplate] = useState<RoleTemplate | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<RoleTemplate | null>(null);
  const [loading, setLoading] = useState(false);

  // Create/Edit form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formScope, setFormScope] = useState<'agency' | 'client'>('agency');
  const [formPermissions, setFormPermissions] = useState<string[]>([]);

  const builtInTemplates = templates.filter((t) => t.isBuiltIn);
  const customTemplates = templates.filter((t) => !t.isBuiltIn);
  const userPermSet = new Set(userPermissions);

  // Compute permissions the user cannot grant (they don't hold them)
  function getDisabledPermissions(scope: string): Set<string> {
    const groups = getPermissionGroups(scope);
    const disabled = new Set<string>();
    for (const group of Object.values(groups)) {
      for (const perm of group.permissions) {
        if (!userPermSet.has(perm.key)) {
          disabled.add(perm.key);
        }
      }
    }
    return disabled;
  }

  function getPermissionGroups(scope: string) {
    return scope === 'agency' ? AGENCY_PERMISSION_GROUPS : CLIENT_PERMISSION_GROUPS;
  }

  function togglePermission(perm: string) {
    setFormPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }

  function openCreate() {
    setFormName('');
    setFormDescription('');
    setFormScope('agency');
    setFormPermissions([]);
    setCreateOpen(true);
  }

  function openEdit(template: RoleTemplate) {
    setFormName(template.name);
    setFormDescription(template.description || '');
    setFormScope(template.scope as 'agency' | 'client');
    setFormPermissions([...template.permissions]);
    setEditTemplate(template);
  }

  async function handleCreate() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          description: formDescription || undefined,
          scope: formScope,
          permissions: formPermissions,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error || 'Failed to create role');
        return;
      }

      setCreateOpen(false);
      router.refresh();
    } catch {
      alert('Failed to create role');
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit() {
    if (!editTemplate) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/roles/${editTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          description: formDescription || undefined,
          permissions: formPermissions,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error || 'Failed to update role');
        return;
      }

      setEditTemplate(null);
      router.refresh();
    } catch {
      alert('Failed to update role');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTemplate) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/roles/${deleteTemplate.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error || 'Failed to delete role');
        return;
      }

      setDeleteTemplate(null);
      router.refresh();
    } catch {
      alert('Failed to delete role');
    } finally {
      setLoading(false);
    }
  }

  function renderPermissionChecklist(
    scope: string,
    permissions: string[],
    readOnly: boolean,
    disabledPermissions?: Set<string>
  ) {
    const groups = getPermissionGroups(scope);

    return (
      <div className="space-y-2">
        {Object.entries(groups).map(([groupKey, group]) => (
          <Collapsible key={groupKey} defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-accent text-sm font-medium">
              <ChevronDown className="size-4" />
              {group.label}
              <Badge variant="secondary" className="ml-auto text-xs">
                {group.permissions.filter((p) => permissions.includes(p.key)).length}/
                {group.permissions.length}
              </Badge>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-6 space-y-1">
              {group.permissions.map((perm) => {
                const isDisabled = readOnly || disabledPermissions?.has(perm.key);
                return (
                  <label
                    key={perm.key}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${
                      isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent cursor-pointer'
                    }`}
                  >
                    <Checkbox
                      checked={permissions.includes(perm.key)}
                      onCheckedChange={() => !isDisabled && togglePermission(perm.key)}
                      disabled={isDisabled}
                    />
                    {perm.label}
                    {!readOnly && disabledPermissions?.has(perm.key) && (
                      <Lock className="size-3 text-muted-foreground ml-auto" />
                    )}
                  </label>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Built-in Roles */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Built-in Roles</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {builtInTemplates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="size-4 text-muted-foreground" />
                  {template.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {template.permissions.length} permission
                      {template.permissions.length !== 1 ? 's' : ''}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        template.scope === 'agency'
                          ? 'border-forest text-forest'
                          : 'border-olive text-olive'
                      }
                    >
                      {template.scope === 'agency' ? 'Agency' : 'Client Portal'}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewTemplate(template)}
                  >
                    View
                  </Button>
                </div>
                {template.description && (
                  <p className="text-xs text-muted-foreground mt-2">{template.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Custom Roles */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Custom Roles</h2>
          <Button onClick={openCreate}>
            <Plus className="size-4 mr-2" />
            Create Custom Role
          </Button>
        </div>

        {customTemplates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No custom roles yet</h3>
              <p className="text-muted-foreground mb-4">
                Create custom roles to define specific permission sets for your team.
              </p>
              <Button onClick={openCreate}>
                <Plus className="size-4 mr-2" />
                Create Custom Role
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {customTemplates.map((template) => (
              <Card key={template.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {template.permissions.length} permission
                        {template.permissions.length !== 1 ? 's' : ''}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          template.scope === 'agency'
                            ? 'border-forest text-forest'
                            : 'border-olive text-olive'
                        }
                      >
                        {template.scope === 'agency' ? 'Agency' : 'Client Portal'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(template)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteTemplate(template)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  {template.usageCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Used by {template.usageCount} member
                      {template.usageCount !== 1 ? 's' : ''}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* View Permissions Dialog (read-only) */}
      <Dialog open={!!viewTemplate} onOpenChange={(open) => !open && setViewTemplate(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewTemplate?.name} Permissions
            </DialogTitle>
          </DialogHeader>
          {viewTemplate && renderPermissionChecklist(
            viewTemplate.scope,
            viewTemplate.permissions,
            true
          )}
        </DialogContent>
      </Dialog>

      {/* Create Role Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Custom Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Senior Manager"
              />
            </div>
            <div>
              <Label htmlFor="create-desc">Description (optional)</Label>
              <Input
                id="create-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description"
              />
            </div>
            <div>
              <Label>Scope</Label>
              <Select
                value={formScope}
                onValueChange={(v) => {
                  setFormScope(v as 'agency' | 'client');
                  setFormPermissions([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency">Agency</SelectItem>
                  <SelectItem value="client">Client Portal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Permissions</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Permissions you don&apos;t hold are locked.
              </p>
              <div className="border rounded-md p-2 mt-1 max-h-64 overflow-y-auto">
                {renderPermissionChecklist(formScope, formPermissions, false, getDisabledPermissions(formScope))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formName || formPermissions.length === 0 || loading}
              >
                {loading ? 'Creating...' : 'Create Role'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editTemplate} onOpenChange={(open) => !open && setEditTemplate(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editTemplate && editTemplate.usageCount > 0 && (
              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                {editTemplate.usageCount} member{editTemplate.usageCount !== 1 ? 's' : ''} use
                this role. Changes will take effect immediately and they will be logged out.
              </p>
            )}
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-desc">Description (optional)</Label>
              <Input
                id="edit-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div>
              <Label>Scope</Label>
              <Select value={formScope} disabled>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency">Agency</SelectItem>
                  <SelectItem value="client">Client Portal</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Scope cannot be changed after creation.
              </p>
            </div>
            <div>
              <Label>Permissions</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Permissions you don&apos;t hold are locked.
              </p>
              <div className="border rounded-md p-2 mt-1 max-h-64 overflow-y-auto">
                {renderPermissionChecklist(formScope, formPermissions, false, getDisabledPermissions(formScope))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditTemplate(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleEdit}
                disabled={!formName || formPermissions.length === 0 || loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTemplate} onOpenChange={(open) => !open && setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTemplate?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the &quot;{deleteTemplate?.name}&quot; role template.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
