'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Props {
  sentinelTotal: number;
  sentinelLast7Days: number;
  sentinelLastBlockAt: string | null;
  sentinelByReason: Record<string, number>;
  lastAuditExportAt: string | null;
  lastAuditExportObjectKey: string | null;
  lastAuditExportRetainUntil: string | null;
}

const NEUTRAL_TEXT = '#1B2F26';
const MUTED_TEXT = '#6B7280';
const ALERT_TEXT = '#C15B2E';
const SUCCESS_TEXT = '#3D7A50';
const WARNING_BG = '#FDEAE4';
const NEUTRAL_BG = '#F8F9FA';

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString('en-CA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function formatReason(reason: string): string {
  // kill_switch -> Kill switch, platform_dnc -> Platform DNC
  if (reason === 'platform_dnc') return 'Platform DNC';
  return reason
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function ComplianceObservabilityPanel({
  sentinelTotal,
  sentinelLast7Days,
  sentinelLastBlockAt,
  sentinelByReason,
  lastAuditExportAt,
  lastAuditExportObjectKey,
  lastAuditExportRetainUntil,
}: Props) {
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const sentinelHasBlocks = sentinelTotal > 0;
  const sentinelColor = sentinelHasBlocks ? ALERT_TEXT : SUCCESS_TEXT;

  async function handleManualExport() {
    setExporting(true);
    setExportResult(null);
    setExportError(null);
    try {
      const response = await fetch('/api/admin/audit-log-export/run', {
        method: 'POST',
      });
      if (!response.ok) {
        const detail = await response.text();
        setExportError(`Export failed (${response.status}): ${detail.slice(0, 240)}`);
      } else {
        const data = (await response.json()) as {
          key?: string;
          recordCount?: number;
          retainUntil?: string;
        };
        setExportResult(
          `Export complete. Records: ${data.recordCount ?? 0}. Key: ${data.key ?? 'unknown'}. Retain until: ${data.retainUntil ?? 'unknown'}. (Reload page to refresh dashboard.)`,
        );
      }
    } catch (err) {
      setExportError(
        `Export failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold" style={{ color: NEUTRAL_TEXT }}>
          Compliance Observability
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Sentinel blocks and audit-log export status. Non-zero sentinel blocks
          indicate a bypass attempt was caught &mdash; investigate immediately.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sentinel block counter */}
        <div
          className="rounded-md p-4"
          style={{
            backgroundColor: sentinelHasBlocks ? WARNING_BG : NEUTRAL_BG,
          }}
        >
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div>
              <p
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: MUTED_TEXT }}
              >
                Compliance Sentinel Blocks (lifetime)
              </p>
              <p
                className="text-3xl font-bold mt-1 tabular-nums"
                style={{ color: sentinelColor }}
              >
                {sentinelTotal}
              </p>
            </div>
            <div className="text-right">
              <p
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: MUTED_TEXT }}
              >
                Last 7 days
              </p>
              <p
                className="text-2xl font-semibold mt-1 tabular-nums"
                style={{ color: sentinelLast7Days > 0 ? ALERT_TEXT : NEUTRAL_TEXT }}
              >
                {sentinelLast7Days}
              </p>
            </div>
          </div>
          <p className="text-xs mt-3" style={{ color: MUTED_TEXT }}>
            {sentinelHasBlocks
              ? 'Non-zero indicates a bypass attempt was caught. '
              : 'No blocks recorded. '}
            Last block:{' '}
            <span style={{ color: NEUTRAL_TEXT }}>
              {formatTimestamp(sentinelLastBlockAt)}
            </span>
          </p>
          {Object.keys(sentinelByReason).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(sentinelByReason).map(([reason, count]) => (
                <span
                  key={reason}
                  className="text-xs px-2 py-1 rounded font-medium"
                  style={{
                    backgroundColor: '#FFFFFF',
                    color: NEUTRAL_TEXT,
                    border: '1px solid #E5E7EB',
                  }}
                >
                  {formatReason(reason)}: {count}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Audit log export status */}
        <div className="rounded-md p-4" style={{ backgroundColor: NEUTRAL_BG }}>
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: MUTED_TEXT }}
              >
                Last R2 Audit Log Export
              </p>
              <p
                className="text-base font-semibold mt-1"
                style={{ color: NEUTRAL_TEXT }}
              >
                {formatTimestamp(lastAuditExportAt)}
              </p>
              {lastAuditExportAt ? (
                <dl className="text-xs mt-2 space-y-1">
                  {lastAuditExportObjectKey && (
                    <div className="flex flex-wrap gap-x-2">
                      <dt style={{ color: MUTED_TEXT }}>R2 object key:</dt>
                      <dd
                        className="font-mono break-all"
                        style={{ color: NEUTRAL_TEXT }}
                      >
                        {lastAuditExportObjectKey}
                      </dd>
                    </div>
                  )}
                  {lastAuditExportRetainUntil && (
                    <div className="flex flex-wrap gap-x-2">
                      <dt style={{ color: MUTED_TEXT }}>Retain until:</dt>
                      <dd style={{ color: NEUTRAL_TEXT }}>
                        {formatTimestamp(lastAuditExportRetainUntil)}{' '}
                        <span style={{ color: MUTED_TEXT }}>
                          (COMPLIANCE-mode Object Lock)
                        </span>
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-xs mt-1" style={{ color: ALERT_TEXT }}>
                  No export recorded yet. Cron fires Sundays 3am UTC.
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleManualExport}
              disabled={exporting}
            >
              {exporting ? 'Running...' : 'Run export now'}
            </Button>
          </div>
          {exportResult && (
            <p
              className="text-xs mt-3 font-mono break-all"
              style={{ color: SUCCESS_TEXT }}
            >
              {exportResult}
            </p>
          )}
          {exportError && (
            <p className="text-xs mt-3" style={{ color: ALERT_TEXT }}>
              {exportError}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
