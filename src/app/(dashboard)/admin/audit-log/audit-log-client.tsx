'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { ChevronDown, ChevronRight, FileText, X } from 'lucide-react';

const ACTION_CATEGORIES: Record<string, { label: string; actions: string[] }> = {
  auth: {
    label: 'Authentication',
    actions: ['auth.login', 'auth.logout', 'auth.session_invalidated'],
  },
  team: {
    label: 'Team Changes',
    actions: ['member.invited', 'member.removed', 'member.reactivated', 'member.updated'],
  },
  role: {
    label: 'Role Changes',
    actions: ['role.changed', 'role.created', 'role.updated', 'role.deleted', 'permission.overridden'],
  },
  ownership: {
    label: 'Ownership',
    actions: ['owner.transferred'],
  },
  client: {
    label: 'Client Status',
    actions: ['client.suspended', 'client.reactivated'],
  },
};

const ALL_ACTIONS = Object.values(ACTION_CATEGORIES).flatMap((c) => c.actions);

function getActionBadgeColor(action: string): string {
  if (action.startsWith('auth.')) return 'bg-blue-100 text-blue-800';
  if (action.startsWith('member.invited') || action.startsWith('member.reactivated'))
    return 'bg-green-100 text-green-800';
  if (action.startsWith('member.removed')) return 'bg-red-100 text-red-800';
  if (action.startsWith('role.')) return 'bg-amber-100 text-amber-800';
  if (action.startsWith('owner.')) return 'bg-purple-100 text-purple-800';
  return 'bg-gray-100 text-gray-800';
}

function formatAction(action: string): string {
  return action
    .replace(/\./g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function generateDescription(
  action: string,
  metadata: Record<string, unknown> | null
): string {
  if (!metadata) return action;

  const m = metadata;

  switch (action) {
    case 'member.invited':
      return `Added ${m.memberName || 'member'} as ${m.roleName || m.role || 'team member'}`;
    case 'member.removed':
      return `Removed ${m.memberName || 'member'}`;
    case 'member.updated':
      return `Updated ${m.memberName || 'member'}`;
    case 'role.changed':
      return `Changed role for ${m.memberName || 'member'}`;
    case 'role.created':
      return `Created role "${m.roleName || 'unknown'}"`;
    case 'role.updated':
      return `Updated role "${m.roleName || 'unknown'}"`;
    case 'role.deleted':
      return `Deleted role "${m.roleName || 'unknown'}"`;
    case 'permission.overridden':
      return `Updated permissions for ${m.memberName || 'member'}`;
    case 'owner.transferred':
      return `Transferred ownership from ${m.previousOwnerName || 'previous owner'} to ${m.newOwnerName || 'new owner'}`;
    default:
      return formatAction(action);
  }
}

interface AuditEntry {
  id: string;
  personId: string | null;
  personName: string | null;
  personEmail: string | null;
  clientId: string | null;
  clientName: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface FilterOptions {
  action: string;
  personId: string;
  clientId: string;
  from: string;
  to: string;
}

interface PersonOption {
  id: string;
  name: string;
}

interface ClientOption {
  id: string;
  businessName: string;
}

interface AuditLogClientProps {
  entries: AuditEntry[];
  pagination: Pagination;
  filters: FilterOptions;
  people: PersonOption[];
  clients: ClientOption[];
}

export function AuditLogClient({
  entries,
  pagination,
  filters,
  people: peopleOptions,
  clients: clientOptions,
}: AuditLogClientProps) {
  const router = useRouter();
  const currentParams = useSearchParams();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function updateFilters(updates: Partial<FilterOptions & { page: string }>) {
    const params = new URLSearchParams(currentParams.toString());

    // Reset to page 1 when filters change
    if (!('page' in updates)) {
      params.set('page', '1');
    }

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    router.push(`/admin/audit-log?${params.toString()}`);
  }

  function clearFilters() {
    router.push('/admin/audit-log');
  }

  const hasFilters = filters.action || filters.personId || filters.clientId || filters.from || filters.to;

  if (entries.length === 0 && !hasFilters) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="size-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No audit entries yet</h3>
          <p className="text-muted-foreground">
            Actions will be logged here as team members are added and permissions change.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-48">
              <Select
                value={filters.action || 'all'}
                onValueChange={(v) => updateFilters({ action: v === 'all' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Action type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {Object.entries(ACTION_CATEGORIES).map(([key, category]) => (
                    <SelectItem key={key} value={key} disabled>
                      {category.label}
                    </SelectItem>
                  ))}
                  {ALL_ACTIONS.map((action) => (
                    <SelectItem key={action} value={action}>
                      {formatAction(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select
                value={filters.personId || 'all'}
                onValueChange={(v) => updateFilters({ personId: v === 'all' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All people</SelectItem>
                  {peopleOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select
                value={filters.clientId || 'all'}
                onValueChange={(v) => updateFilters({ clientId: v === 'all' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clientOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.businessName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => updateFilters({ from: e.target.value })}
                placeholder="From"
              />
            </div>
            <div className="w-40">
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => updateFilters({ to: e.target.value })}
                placeholder="To"
              />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const isExpanded = expandedId === entry.id;
                return (
                  <>
                    <TableRow
                      key={entry.id}
                      className="cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    >
                      <TableCell className="px-2">
                        {isExpanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatTimestamp(entry.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {entry.personName || 'System'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={getActionBadgeColor(entry.action)}
                        >
                          {formatAction(entry.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.clientName || '-'}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm">
                        {generateDescription(entry.action, entry.metadata)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {entry.ipAddress || '-'}
                      </TableCell>
                    </TableRow>
                    {isExpanded && entry.metadata && (
                      <TableRow key={`${entry.id}-detail`}>
                        <TableCell colSpan={7} className="bg-muted/50">
                          <pre className="text-xs p-3 overflow-x-auto">
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No audit entries match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => updateFilters({ page: String(pagination.page - 1) })}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateFilters({ page: String(pagination.page + 1) })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
