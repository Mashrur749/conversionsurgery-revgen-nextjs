'use client';

import { ComplianceDashboard } from '@/components/compliance/ComplianceDashboard';
import type { OptOutReasonCount } from '@/components/compliance/ComplianceDashboard';

interface Props {
  stats: {
    activeConsents: number;
    totalOptOuts: number;
    optOutRate: number;
    dncListSize: number;
    messagesBlocked: number;
    complianceScore: number;
  };
  risks: string[];
  quietHoursPolicy: {
    environmentMode: 'STRICT_ALL_OUTBOUND_QUEUE' | 'INBOUND_REPLY_ALLOWED';
    overrideCount: number;
    overrides: Array<{
      clientId: string;
      businessName: string | null;
      mode: 'STRICT_ALL_OUTBOUND_QUEUE' | 'INBOUND_REPLY_ALLOWED';
      updatedAt: string;
    }>;
  };
  optOutReasonBreakdown: OptOutReasonCount[];
}

export function ComplianceDashboardClient({ stats, risks, quietHoursPolicy, optOutReasonBreakdown }: Props) {
  const handleDownloadReport = async () => {
    try {
      const res = await fetch('/api/compliance/report?months=1');
      const report = await res.json();
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[Compliance] Report download failed:', error);
    }
  };

  return (
    <ComplianceDashboard
      stats={stats}
      risks={risks}
      quietHoursPolicy={quietHoursPolicy}
      optOutReasonBreakdown={optOutReasonBreakdown}
      onDownloadReport={handleDownloadReport}
    />
  );
}
