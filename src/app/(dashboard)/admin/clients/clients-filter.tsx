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
    { value: 'active', label: 'Active', color: 'bg-[#E8F5E9] text-[#3D7A50] hover:bg-[#C8E6C9]' },
    { value: 'pending', label: 'Pending', color: 'bg-[#FFF3E0] text-sienna hover:bg-[#FFE0B2]' },
    { value: 'cancelled', label: 'Cancelled', color: 'bg-muted text-foreground hover:bg-muted' },
    { value: 'all', label: 'All', color: 'bg-muted text-foreground hover:bg-accent' },
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
                : 'bg-[#F8F9FA] text-foreground hover:bg-muted'
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
                <div className="px-4 py-3 bg-[#F8F9FA] text-sm font-medium text-foreground">
                  {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
                </div>
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-4 hover:bg-[#F8F9FA] transition-colors"
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
