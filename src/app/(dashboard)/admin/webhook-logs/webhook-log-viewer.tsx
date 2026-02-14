'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface LogEntry {
  id: string;
  clientId: string;
  eventType: string | null;
  payload: unknown;
  responseStatus: number | null;
  responseBody: string | null;
  createdAt: string;
}

export function WebhookLogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (filterType) params.set('eventType', filterType);

    fetch(`/api/admin/webhook-logs?${params}`)
      .then((r) => r.json() as Promise<{ logs: LogEntry[] }>)
      .then((data) => {
        setLogs(data.logs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, filterType]);

  const eventTypes = [...new Set(logs.map((l) => l.eventType).filter(Boolean))];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">All event types</option>
          {eventTypes.map((t) => (
            <option key={t} value={t!}>{t}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No webhook logs found.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={log.responseStatus && log.responseStatus < 400 ? 'default' : 'destructive'}>
                      {log.responseStatus || '—'}
                    </Badge>
                    <Badge variant="outline">{log.eventType || 'unknown'}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.createdAt), 'MMM d, h:mm:ss a')}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  >
                    {expanded === log.id ? 'Hide' : 'Payload'}
                  </Button>
                </div>
                {expanded === log.id && (
                  <pre className="mt-2 text-xs bg-gray-50 rounded p-3 overflow-auto max-h-64">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(page + 1)}
          disabled={logs.length < 50}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
