'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, AlertTriangle, Shield } from 'lucide-react';

/** Aggregate compliance statistics for the dashboard display */
export interface ComplianceStats {
  activeConsents: number;
  totalOptOuts: number;
  optOutRate: number;
  dncListSize: number;
  messagesBlocked: number;
  complianceScore: number;
}

/** Props for the ComplianceDashboard component */
interface ComplianceDashboardProps {
  stats: ComplianceStats;
  risks: string[];
  onDownloadReport: () => void;
}

/** Score badge configuration returned by getScoreBadge */
interface ScoreBadge {
  label: string;
  color: string;
}

/** Returns a Tailwind color class based on the compliance score threshold */
function getScoreColor(score: number): string {
  if (score >= 90) return 'text-[#3D7A50]';
  if (score >= 70) return 'text-sienna';
  return 'text-destructive';
}

/** Returns a label and color class for the compliance score badge */
function getScoreBadge(score: number): ScoreBadge {
  if (score >= 90)
    return { label: 'Excellent', color: 'bg-[#E8F5E9] text-[#3D7A50]' };
  if (score >= 70)
    return { label: 'Good', color: 'bg-[#FFF3E0] text-sienna' };
  return { label: 'Needs Attention', color: 'bg-[#FDEAE4] text-sienna' };
}

/**
 * Displays TCPA compliance metrics, score, risks, and a report download button.
 * Used as the main visual component on the admin compliance page.
 */
export function ComplianceDashboard({
  stats,
  risks,
  onDownloadReport,
}: ComplianceDashboardProps) {
  const scoreBadge = getScoreBadge(stats.complianceScore);

  return (
    <div className="space-y-6">
      {/* Compliance Score */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            TCPA Compliance Score
          </CardTitle>
          <Badge className={scoreBadge.color}>{scoreBadge.label}</Badge>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div
              className={`text-4xl font-bold ${getScoreColor(stats.complianceScore)}`}
            >
              {stats.complianceScore}%
            </div>
            <Progress value={stats.complianceScore} className="flex-1 h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Active Consents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.activeConsents.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Opt-Outs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalOptOuts.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.optOutRate.toFixed(1)}% rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">DNC List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.dncListSize.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Messages Blocked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.messagesBlocked.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risks */}
      {risks.length > 0 && (
        <Card className="border-olive/30 bg-accent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-forest">
              <AlertTriangle className="h-5 w-5" />
              Compliance Risks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {risks.map((risk, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-forest"
                >
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {risk}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Download Report */}
      <div className="flex justify-end">
        <Button onClick={onDownloadReport}>
          <Download className="mr-2 h-4 w-4" />
          Download Compliance Report
        </Button>
      </div>
    </div>
  );
}
