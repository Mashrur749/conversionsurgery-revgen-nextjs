'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Clock,
  BarChart3,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  Settings,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SendMessageDialog } from './send-message-dialog';
import { SettingsDialog } from './settings-dialog';

type Stats = {
  totalMessages: number;
  pendingPrompts: number;
  weeklyDigests: number;
  activeClients: number;
};

type ClientOption = {
  id: string;
  businessName: string;
};

type Message = {
  id: string;
  clientId: string;
  clientName: string | null;
  direction: string;
  channel: string;
  content: string;
  subject: string | null;
  category: string;
  promptType: string | null;
  actionStatus: string | null;
  clientReply: string | null;
  delivered: boolean;
  createdAt: string;
  expiresAt: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
};

const categories = [
  { value: null, label: 'All' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'weekly_digest', label: 'Digest' },
  { value: 'action_prompt', label: 'Prompts' },
  { value: 'alert', label: 'Alerts' },
  { value: 'custom', label: 'Custom' },
  { value: 'reply', label: 'Replies' },
];

const categoryColors: Record<string, string> = {
  onboarding: 'bg-blue-100 text-blue-800',
  weekly_digest: 'bg-purple-100 text-purple-800',
  action_prompt: 'bg-amber-100 text-amber-800',
  alert: 'bg-red-100 text-red-800',
  custom: 'bg-gray-100 text-gray-800',
  reply: 'bg-green-100 text-green-800',
};

export function AgencyDashboard({
  stats,
  agencyNumber: initialAgencyNumber,
  clients,
}: {
  stats: Stats;
  agencyNumber: string | null;
  clients: ClientOption[];
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedDirection, setSelectedDirection] = useState<string>('');

  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [agencyNumber, setAgencyNumber] = useState(initialAgencyNumber);

  const fetchMessages = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const url = new URL('/api/admin/agency/messages', window.location.origin);
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', '20');
      if (selectedCategory) url.searchParams.set('category', selectedCategory);
      if (selectedClient) url.searchParams.set('clientId', selectedClient);

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch messages');

      const data = await res.json() as { messages: Message[]; pagination: Pagination };

      let filtered = data.messages;
      if (selectedDirection) {
        filtered = filtered.filter(
          (m: Message) => m.direction === selectedDirection
        );
      }

      setMessages(filtered);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedClient, selectedDirection]);

  useEffect(() => {
    fetchMessages(1);
  }, [fetchMessages]);

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agency Communication</h1>
          <p className="text-sm text-gray-500">
            Manage client notifications and prompts
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettingsDialog(true)}
          >
            <Settings className="size-4" />
            Settings
          </Button>
          <Button size="sm" onClick={() => setShowSendDialog(true)}>
            <Send className="size-4" />
            Send Message
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<MessageSquare className="size-5 text-blue-600" />}
          label="Messages"
          value={stats.totalMessages}
        />
        <StatCard
          icon={<Clock className="size-5 text-amber-600" />}
          label="Pending"
          value={stats.pendingPrompts}
        />
        <StatCard
          icon={<BarChart3 className="size-5 text-purple-600" />}
          label="Digests"
          value={stats.weeklyDigests}
        />
        <StatCard
          icon={<Users className="size-5 text-green-600" />}
          label="Active Clients"
          value={stats.activeClients}
        />
      </div>

      {/* Agency Number Warning */}
      {!agencyNumber && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="size-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            Agency number not configured. You won&apos;t be able to send messages.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto shrink-0"
            onClick={() => setShowSettingsDialog(true)}
          >
            Configure
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.label}
              onClick={() => setSelectedCategory(cat.value)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                selectedCategory === cat.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.businessName}
              </option>
            ))}
          </select>
          <select
            value={selectedDirection}
            onChange={(e) => setSelectedDirection(e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            <option value="">All Directions</option>
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Message List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-gray-100"
            />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center">
          <MessageSquare className="mx-auto size-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No messages found</p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => setShowSendDialog(true)}
          >
            Send First Message
          </Button>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {messages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {msg.direction === 'outbound' ? (
                        <ArrowUpRight className="size-4 text-blue-500" />
                      ) : (
                        <ArrowDownLeft className="size-4 text-green-500" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {msg.clientName || 'Unknown'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          categoryColors[msg.category] ||
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {msg.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-600">
                      {msg.content}
                    </td>
                    <td className="px-4 py-3">
                      <MessageStatus msg={msg} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {new Date(msg.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {pagination.total} total messages
              </p>
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - pagination.page) <= 1
                  )
                  .map((p, idx, arr) => (
                    <span key={p} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-1 text-gray-400">...</span>
                      )}
                      <button
                        onClick={() => fetchMessages(p)}
                        className={`min-w-[2rem] rounded px-2 py-1 text-sm ${
                          p === pagination.page
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {p}
                      </button>
                    </span>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <SendMessageDialog
        open={showSendDialog}
        onOpenChange={setShowSendDialog}
        clients={clients}
        onSuccess={() => fetchMessages(pagination.page)}
      />
      <SettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        onSaved={(number) => setAgencyNumber(number)}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function MessageStatus({ msg }: { msg: Message }) {
  if (msg.actionStatus) {
    const statusStyles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800',
      replied: 'bg-blue-100 text-blue-800',
      executed: 'bg-green-100 text-green-800',
      expired: 'bg-gray-100 text-gray-500',
    };
    return (
      <Badge
        className={statusStyles[msg.actionStatus] || 'bg-gray-100 text-gray-800'}
      >
        {msg.actionStatus}
      </Badge>
    );
  }
  if (msg.delivered) {
    return <Badge className="bg-green-100 text-green-800">Delivered</Badge>;
  }
  return <Badge className="bg-gray-100 text-gray-500">--</Badge>;
}
