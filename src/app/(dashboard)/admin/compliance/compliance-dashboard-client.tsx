'use client';

import { ComplianceDashboard } from '@/components/compliance/ComplianceDashboard';

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
}

export function ComplianceDashboardClient({ stats, risks }: Props) {
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
      onDownloadReport={handleDownloadReport}
    />
  );
}
