'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface UsageDisplayProps {
  usage: {
    leads: {
      used: number;
      included: number | null;
      overage: number;
      overageCostCents?: number;
      allowOverages?: boolean;
    };
    teamMembers: {
      used: number;
      included: number;
    };
    phoneNumbers: {
      used: number;
      included: number;
    };
  };
  periodStart: Date;
  periodEnd: Date;
}

export function UsageDisplay({ usage, periodStart, periodEnd }: UsageDisplayProps) {
  const leadsPercent = usage.leads.included
    ? Math.min((usage.leads.used / usage.leads.included) * 100, 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Usage This Period
        </CardTitle>
        <CardDescription>
          {format(periodStart, 'MMM d')} - {format(periodEnd, 'MMM d, yyyy')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overage Warning */}
        {usage.leads.overage > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You have {usage.leads.overage} overage leads this period.
              {usage.leads.overageCostCents
                ? ` Estimated overage charge: $${(usage.leads.overageCostCents / 100).toFixed(2)}.`
                : ' Consider upgrading your plan for more capacity.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Leads */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Leads</span>
            <span>
              {usage.leads.used.toLocaleString()}
              {usage.leads.included
                ? ` / ${usage.leads.included.toLocaleString()}`
                : ' (Unlimited)'}
            </span>
          </div>
          {usage.leads.included && (
            <Progress value={leadsPercent} className="h-2" />
          )}
        </div>

        {/* Team Members */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Team Members</span>
            <span>
              {usage.teamMembers.used} / {usage.teamMembers.included}
            </span>
          </div>
          <Progress
            value={(usage.teamMembers.used / usage.teamMembers.included) * 100}
            className="h-2"
          />
        </div>

        {/* Phone Numbers */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Phone Numbers</span>
            <span>
              {usage.phoneNumbers.used} / {usage.phoneNumbers.included}
            </span>
          </div>
          <Progress
            value={(usage.phoneNumbers.used / usage.phoneNumbers.included) * 100}
            className="h-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}
