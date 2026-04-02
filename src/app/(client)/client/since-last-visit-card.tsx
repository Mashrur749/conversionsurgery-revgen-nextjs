'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface ActivitySummary {
  leadsResponded: number;
  estimatesFollowedUp: number;
  appointmentsBooked: number;
  actionsNeeded: number;
  since: string;
}

interface SinceLastVisitCardProps {
  clientId: string;
}

export function SinceLastVisitCard({ clientId }: SinceLastVisitCardProps) {
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastVisit, setLastVisit] = useState<Date | null>(null);

  useEffect(() => {
    const storageKey = `cs-last-dashboard-visit-${clientId}`;
    const stored = localStorage.getItem(storageKey);
    const now = new Date();

    // Read the previous visit timestamp before updating
    const previousVisit = stored ? new Date(stored) : null;
    setLastVisit(previousVisit);

    // Update last visit to now
    localStorage.setItem(storageKey, now.toISOString());

    // Use a 7-day default if no prior visit on record
    const since = previousVisit ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    fetch(`/api/client/activity-summary?since=${encodeURIComponent(since.toISOString())}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (data && typeof data === 'object' && 'leadsResponded' in data) {
          setSummary(data as ActivitySummary);
        }
      })
      .catch(() => {
        // Silently fail — the rest of the dashboard still works
      })
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return (
      <Card className="border-[#C8D4CC]">
        <CardContent className="py-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading recent activity&hellip;
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const hasActivity =
    summary.leadsResponded > 0 ||
    summary.estimatesFollowedUp > 0 ||
    summary.appointmentsBooked > 0;

  const activityParts: string[] = [];
  if (summary.leadsResponded > 0) {
    activityParts.push(
      `${summary.leadsResponded} ${summary.leadsResponded === 1 ? 'lead' : 'leads'} responded to`
    );
  }
  if (summary.estimatesFollowedUp > 0) {
    activityParts.push(
      `${summary.estimatesFollowedUp} ${summary.estimatesFollowedUp === 1 ? 'estimate' : 'estimates'} followed up`
    );
  }
  if (summary.appointmentsBooked > 0) {
    activityParts.push(
      `${summary.appointmentsBooked} ${summary.appointmentsBooked === 1 ? 'appointment' : 'appointments'} booked`
    );
  }

  const isAllClear = summary.actionsNeeded === 0;

  return (
    <Card
      className={
        isAllClear
          ? 'border-[#3D7A50]/30 bg-[#E8F5E9]'
          : 'border-[#C15B2E]/30 bg-[#FFF3E0]'
      }
    >
      <CardContent className="py-4 space-y-2">
        {/* Header */}
        <p className="text-sm font-semibold text-[#1B2F26]">
          Since your last visit
          {lastVisit && (
            <span className="font-normal text-muted-foreground">
              {' '}({formatDistanceToNow(lastVisit, { addSuffix: true })})
            </span>
          )}
        </p>

        {/* Activity line */}
        {hasActivity ? (
          <p className="text-sm text-[#1B2F26]">
            {activityParts.join(' \u00b7 ')}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No automated activity since your last visit.</p>
        )}

        {/* Action status */}
        {isAllClear ? (
          <div className="flex items-center gap-1.5 text-sm text-[#3D7A50] font-medium">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Nothing needs your attention
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-sm text-[#C15B2E] font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {summary.actionsNeeded} {summary.actionsNeeded === 1 ? 'item needs' : 'items need'} your attention
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 border-[#C15B2E]/40 text-[#C15B2E] hover:bg-[#C15B2E]/10">
              <Link href="/client/conversations">View</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
