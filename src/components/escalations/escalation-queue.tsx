'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Clock,
  User,
  MessageSquare,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

/**
 * Props for EscalationQueue component
 */
interface EscalationQueueProps {
  clientId?: string;
  isAgency?: boolean;
}

interface Escalation {
  escalation: {
    id: string;
    reason: string;
    reasonDetails: string | null;
    priority: number;
    status: string;
    slaBreach: boolean;
    slaDeadline: string | null;
    createdAt: string;
  };
  lead: {
    id: string;
    name: string | null;
    phone: string;
  } | null;
  assignee: {
    id: string;
    name: string;
  } | null;
}

interface Summary {
  pending: number;
  assigned: number;
  in_progress: number;
  resolved: number;
  slaBreached: number;
}

/**
 * Client option for admin selector
 */
interface ClientOption {
  id: string;
  businessName: string;
}

/**
 * EscalationQueue component - displays escalation queue with filtering and summary statistics
 */
export function EscalationQueue({ clientId: initialClientId, isAgency }: EscalationQueueProps) {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState(initialClientId || '');
  const [clients, setClients] = useState<ClientOption[]>([]);

  // For admin users, fetch client list
  useEffect(() => {
    if (isAgency) {
      fetch('/api/admin/clients')
        .then((res) => res.json())
        .then((data: any) => {
          const clientList = (data.clients || data || []).map((c: any) => ({
            id: c.id,
            businessName: c.businessName,
          }));
          setClients(clientList);
          if (!selectedClientId && clientList.length > 0) {
            setSelectedClientId(clientList[0].id);
          }
        })
        .catch(console.error);
    }
  }, [isAgency]);

  const fetchEscalations = useCallback(async () => {
    if (!selectedClientId) return;

    setLoading(true);
    try {
      const statusFilter = filter === 'active' ? '' : filter;
      const res = await fetch(
        `/api/escalations?clientId=${selectedClientId}${statusFilter ? `&status=${statusFilter}` : ''}`
      );
      const data = await res.json() as { queue?: Escalation[]; summary?: Summary };
      setEscalations(data.queue || []);
      setSummary(data.summary || null);
    } catch (error) {
      console.error('Failed to fetch escalations:', error);
    }
    setLoading(false);
  }, [selectedClientId, filter]);

  useEffect(() => {
    fetchEscalations();
  }, [fetchEscalations]);

  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 1:
        return <Badge variant="destructive">Urgent</Badge>;
      case 2:
        return <Badge className="bg-terracotta text-white">High</Badge>;
      default:
        return <Badge variant="secondary">Normal</Badge>;
    }
  };

  const getStatusBadge = (status: string, slaBreach: boolean) => {
    if (slaBreach) {
      return <Badge variant="destructive">SLA Breach</Badge>;
    }
    switch (status) {
      case 'pending':
        return <Badge className="bg-[#FFF3E0] text-sienna">Pending</Badge>;
      case 'assigned':
        return <Badge variant="secondary">Assigned</Badge>;
      case 'in_progress':
        return <Badge className="bg-forest text-white">In Progress</Badge>;
      case 'resolved':
        return <Badge className="bg-[#3D7A50] text-white">Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const activeCount = (summary?.pending || 0) + (summary?.assigned || 0) + (summary?.in_progress || 0);

  return (
    <div className="space-y-6">
      {/* Admin client selector */}
      {isAgency && clients.length > 0 && (
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Select a client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.businessName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.in_progress}</div>
            </CardContent>
          </Card>

          <Card className={summary.slaBreached > 0 ? 'border-destructive' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">SLA Breached</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${summary.slaBreached > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.slaBreached > 0 ? 'text-destructive' : ''}`}>
                {summary.slaBreached}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="active" onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="active">
            Active ({activeCount})
          </TabsTrigger>
          <TabsTrigger value="pending">Pending ({summary?.pending || 0})</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress ({summary?.in_progress || 0})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({summary?.resolved || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : escalations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-[#3D7A50]" />
                <p>No escalations in this queue</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {escalations.map(({ escalation, lead, assignee }) => (
                <Card
                  key={escalation.id}
                  className={escalation.slaBreach ? 'border-destructive' : ''}
                >
                  <CardContent className="p-3 md:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                        {getPriorityBadge(escalation.priority)}

                        <div className="min-w-0">
                          <div className="font-medium truncate">{lead?.name || 'Unknown Lead'}</div>
                          <div className="text-sm text-muted-foreground">{lead?.phone}</div>
                        </div>

                        {getStatusBadge(escalation.status, escalation.slaBreach)}
                      </div>

                      <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                        <div className="text-left sm:text-right">
                          <div className="text-sm font-medium capitalize">
                            {escalation.reason.replace(/_/g, ' ')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(escalation.createdAt), { addSuffix: true })}
                          </div>
                        </div>

                        {assignee && (
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4" />
                            {assignee.name}
                          </div>
                        )}

                        <Button asChild size="sm">
                          <Link href={`/escalations/${escalation.id}`}>
                            View
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
