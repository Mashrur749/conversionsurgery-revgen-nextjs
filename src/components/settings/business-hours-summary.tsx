'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface BusinessHourRow {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface DayGroup {
  label: string;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(t: string): string {
  // t is "HH:MM" or "HH:MM:SS"
  const [hourStr, minStr] = t.split(':');
  const hour = parseInt(hourStr, 10);
  const min = minStr ?? '00';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${min} ${suffix}`;
}

function groupDays(rows: BusinessHourRow[]): DayGroup[] {
  if (rows.length === 0) return [];

  // Sort by dayOfWeek
  const sorted = [...rows].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  const groups: DayGroup[] = [];
  let startIdx = 0;

  for (let i = 1; i <= sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    const isSame =
      curr &&
      curr.isOpen === prev.isOpen &&
      curr.openTime === prev.openTime &&
      curr.closeTime === prev.closeTime &&
      curr.dayOfWeek === prev.dayOfWeek + 1;

    if (!isSame) {
      const startDay = sorted[startIdx];
      const endDay = prev;
      const startName = DAY_NAMES[startDay.dayOfWeek];
      const endName = DAY_NAMES[endDay.dayOfWeek];
      const label =
        startDay.dayOfWeek === endDay.dayOfWeek
          ? startName
          : `${startName}\u2013${endName}`;

      groups.push({
        label,
        isOpen: prev.isOpen,
        openTime: prev.openTime,
        closeTime: prev.closeTime,
      });
      startIdx = i;
    }
  }

  return groups;
}

interface BusinessHoursApiResponse {
  hours?: BusinessHourRow[];
}

interface BusinessHoursSummaryProps {
  clientId: string;
}

export function BusinessHoursSummary({ clientId }: BusinessHoursSummaryProps) {
  const [rows, setRows] = useState<BusinessHourRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/business-hours?clientId=${encodeURIComponent(clientId)}`)
      .then((res) => res.json() as Promise<BusinessHoursApiResponse>)
      .then((data) => {
        if (!cancelled) setRows(data.hours ?? []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground animate-pulse">
        Loading business hours&hellip;
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[#C15B2E] bg-[#FFF3E0] p-2 text-xs text-[#C15B2E]">
        No business hours configured &mdash; AI will use timezone defaults.{' '}
        <Link
          href={`/admin/clients/${clientId}`}
          className="underline underline-offset-2 hover:opacity-80"
        >
          Configure hours
        </Link>
      </div>
    );
  }

  const groups = groupDays(rows);

  return (
    <div className="rounded-md border border-dashed p-2 text-xs space-y-0.5">
      {groups.map((g) => (
        <div key={g.label} className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground font-medium">{g.label}</span>
          <span className="text-muted-foreground">
            {g.isOpen
              ? `${formatTime(g.openTime)} \u2013 ${formatTime(g.closeTime)}`
              : 'Closed'}
          </span>
        </div>
      ))}
      <div className="pt-1">
        <Link
          href={`/admin/clients/${clientId}`}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:opacity-80"
        >
          Edit hours
        </Link>
      </div>
    </div>
  );
}
