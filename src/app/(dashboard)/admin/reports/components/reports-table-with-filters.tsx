'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  parseReportMetrics,
  parseReportRoiSummary,
} from '@/lib/services/report-dto';

interface ReportRow {
  id: string;
  title: string;
  clientId: string;
  reportType: string;
  startDate: string;
  endDate: string;
  metrics: unknown;
  roiSummary: unknown;
}

interface ClientOption {
  id: string;
  businessName: string;
}

interface Props {
  reports: ReportRow[];
  clients: ClientOption[];
  clientMap: Record<string, ClientOption>;
}

type DatePreset = '7' | '30' | '90' | 'all';

export function ReportsTableWithFilters({ reports, clients, clientMap }: Props) {
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');

  const filteredReports = useMemo(() => {
    let result = reports;

    if (selectedClientId !== 'all') {
      result = result.filter((r) => r.clientId === selectedClientId);
    }

    if (datePreset !== 'all') {
      const days = Number(datePreset);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      result = result.filter((r) => r.endDate >= cutoffStr);
    }

    return result;
  }, [reports, selectedClientId, datePreset]);

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="client-filter" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Client
          </label>
          <select
            id="client-filter"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.businessName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="date-filter" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Period
          </label>
          <select
            id="date-filter"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
        {(selectedClientId !== 'all' || datePreset !== 'all') && (
          <p className="text-xs text-muted-foreground">
            Showing {filteredReports.length} of {reports.length} reports
          </p>
        )}
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {filteredReports.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">
              {reports.length === 0
                ? 'No reports generated yet.'
                : 'No reports match the selected filters.'}
            </p>
            {reports.length === 0 && (
              <Link href="/admin/reports/new" className="mt-4 inline-block">
                <Button>Generate Your First Report</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8F9FA] border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                    Metrics
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredReports.map((report) => {
                  const client = clientMap[report.clientId];
                  const metrics = parseReportMetrics(report.metrics);
                  const roiSummary = parseReportRoiSummary(report.roiSummary);

                  return (
                    <tr key={report.id} className="hover:bg-[#F8F9FA]">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">
                        {report.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {client?.businessName || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 rounded-md bg-sage-light text-forest text-xs font-medium">
                          {report.reportType === 'bi-weekly'
                            ? 'Bi-Weekly'
                            : report.reportType === 'monthly'
                              ? 'Monthly'
                              : 'Custom'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {report.startDate} to {report.endDate}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        <div className="text-xs">
                          <div>
                            {metrics.messagesSent || 0} messages
                          </div>
                          <div>
                            {(roiSummary.conversionRate || 0).toFixed(1)}%
                            conversion
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Link href={`/admin/reports/${report.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
