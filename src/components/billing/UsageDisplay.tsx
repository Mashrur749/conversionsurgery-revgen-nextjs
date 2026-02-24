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
    addOnPricing?: {
      extraTeamMemberUnitCents: number;
      extraNumberUnitCents: number;
      voiceMinuteUnitCents: number;
    };
    addOnExposure?: {
      extraTeamMembers: number;
      extraPhoneNumbers: number;
      projectedMonthlyAddOnCents: number;
    };
    addOnCycle?: {
      subtotalCents: number;
      events: Array<{
        id: string;
        addonType: string;
        sourceType: string;
        sourceRef: string | null;
        quantity: number;
        unitPriceCents: number;
        totalCents: number;
        periodStart: Date;
        periodEnd: Date;
        description: string;
      }>;
    };
  };
  periodStart: Date;
  periodEnd: Date;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function UsageDisplay({ usage, periodStart, periodEnd }: UsageDisplayProps) {
  const isUnlimitedLeads = usage.leads.included === null;
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
        {!isUnlimitedLeads && usage.leads.overage > 0 && (
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

        {/* Add-on pricing transparency */}
        {usage.addOnPricing && (
          <div className="rounded-md border p-3 space-y-2 text-sm">
            <p className="font-medium">Add-On Pricing (CAD)</p>
            <div className="flex justify-between">
              <span>Additional Team Member</span>
              <span>{formatMoney(usage.addOnPricing.extraTeamMemberUnitCents)}/month</span>
            </div>
            <div className="flex justify-between">
              <span>Additional Phone Number</span>
              <span>{formatMoney(usage.addOnPricing.extraNumberUnitCents)}/month</span>
            </div>
            <div className="flex justify-between">
              <span>Voice AI Minutes</span>
              <span>{formatMoney(usage.addOnPricing.voiceMinuteUnitCents)}/minute</span>
            </div>
            {usage.addOnExposure && (
              <div className="pt-2 border-t text-muted-foreground">
                <p>
                  Current extras: {usage.addOnExposure.extraTeamMembers} team member(s),{' '}
                  {usage.addOnExposure.extraPhoneNumbers} number(s)
                </p>
                <p>
                  Projected monthly add-on subtotal:{' '}
                  {formatMoney(usage.addOnExposure.projectedMonthlyAddOnCents)}
                </p>
              </div>
            )}
          </div>
        )}

        {usage.addOnCycle && usage.addOnCycle.events.length > 0 && (
          <div className="rounded-md border p-3 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium">Add-On Charges This Cycle</p>
              <a
                href={`/api/client/billing/addons/export?periodStart=${encodeURIComponent(
                  periodStart.toISOString()
                )}&periodEnd=${encodeURIComponent(periodEnd.toISOString())}`}
                className="text-primary hover:underline"
              >
                Download CSV
              </a>
            </div>
            <div className="space-y-2">
              {usage.addOnCycle.events.map((event) => (
                <div key={event.id} className="flex justify-between">
                  <span>
                    {event.description} @ {formatMoney(event.unitPriceCents)}
                  </span>
                  <span>{formatMoney(event.totalCents)}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t flex justify-between font-medium">
              <span>Cycle add-on subtotal</span>
              <span>{formatMoney(usage.addOnCycle.subtotalCents)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
