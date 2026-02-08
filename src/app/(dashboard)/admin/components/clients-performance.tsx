'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatPhoneNumber } from '@/lib/utils/phone';
import {
  ArrowRight,
  Phone,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import type { Client } from '@/db/schema/clients';
import type { DailyStats } from '@/db/schema/daily-stats';

interface ClientMetrics {
  id: string;
  businessName: string;
  email: string;
  phone: string;
  twilioNumber: string | null;
  status: string | null;
  teamMemberCount: number;
  hasPhoneNumber: boolean;
  todayStats?: DailyStats | undefined;
}

interface Props {
  clients: ClientMetrics[];
}

export function ClientsPerformance({ clients }: Props) {
  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getStatusVariant = (
    status: string | null
  ): 'default' | 'secondary' | 'outline' => {
    switch (status) {
      case 'active':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'cancelled':
        return 'outline';
      default:
        return 'default';
    }
  };

  const sortedClients = [...clients].sort((a, b) => {
    // Active clients first, then pending, then cancelled
    const statusOrder = { active: 0, pending: 1, cancelled: 2 };
    const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 3;
    const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 3;
    return aOrder - bOrder;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Managed Clients</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0 divide-y">
          {sortedClients.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No clients yet. Create one to get started.
            </div>
          ) : (
            sortedClients.map((client) => (
              <div
                key={client.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-base">
                        {client.businessName}
                      </p>
                      {getStatusIcon(client.status)}
                      <Badge variant={getStatusVariant(client.status)}>
                        {client.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {client.email}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/clients/${client.id}`}>
                      View <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>

                {/* Client Metrics Row */}
                <div className="grid grid-cols-4 gap-4 text-sm mt-3">
                  {/* Phone Number */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Phone Number
                    </p>
                    {client.hasPhoneNumber ? (
                      <div className="flex items-center gap-1">
                        <Phone className="w-4 h-4 text-green-600" />
                        <span className="font-mono font-medium text-xs">
                          {formatPhoneNumber(client.twilioNumber!)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-orange-600 font-medium">
                        Not assigned
                      </span>
                    )}
                  </div>

                  {/* Team Members */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Team Members
                    </p>
                    <p className="font-semibold">{client.teamMemberCount}</p>
                  </div>

                  {/* Today's Messages */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Messages Today
                    </p>
                    <p className="font-semibold">
                      {client.todayStats?.messagesSent || 0}
                    </p>
                  </div>

                  {/* Today's Missed Calls */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Missed Calls Captured
                    </p>
                    <p className="font-semibold">
                      {client.todayStats?.missedCallsCaptured || 0}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
