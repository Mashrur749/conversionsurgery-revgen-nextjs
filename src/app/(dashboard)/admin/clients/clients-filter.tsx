'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatPhoneNumber } from '@/lib/utils/phone';
import Link from 'next/link';

interface Props {
  allClients: any[];
}

type FilterStatus = 'all' | 'active' | 'pending' | 'cancelled';

export function ClientsFilter({ allClients }: Props) {
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('active');

  const filteredClients = useMemo(() => {
    if (statusFilter === 'all') {
      return allClients;
    }
    return allClients.filter((client) => client.status === statusFilter);
  }, [allClients, statusFilter]);

  const filters: { value: FilterStatus; label: string; color: string }[] = [
    { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800 hover:bg-green-200' },
    { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' },
    { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-800 hover:bg-gray-200' },
    { value: 'all', label: 'All', color: 'bg-slate-100 text-slate-800 hover:bg-slate-200' },
  ];

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === filter.value
                ? filter.color
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {filter.label}
            {filter.value !== 'all' && (
              <span className="ml-2 font-semibold">
                ({allClients.filter((c) => c.status === filter.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Clients List */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredClients.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {statusFilter === 'all'
                  ? 'No clients found'
                  : `No ${statusFilter} clients found`}
              </div>
            ) : (
              <>
                <div className="px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">
                  {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
                </div>
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <Link href={`/admin/clients/${client.id}`} className="flex-1 min-w-0">
                      <p className="font-semibold">{client.businessName}</p>
                      <p className="text-sm text-muted-foreground">{client.email}</p>
                      {client.twilioNumber && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatPhoneNumber(client.twilioNumber)}
                        </p>
                      )}
                    </Link>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          client.status === 'active'
                            ? 'default'
                            : client.status === 'pending'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {client.status}
                      </Badge>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button asChild size="sm">
                        <Link href={`/admin/clients/${client.id}/phone`}>Phone</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
