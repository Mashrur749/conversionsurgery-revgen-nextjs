'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface SlaCountdownProps {
  deadline: string;
}

function formatRemaining(deadlineMs: number): { label: string; severity: 'ok' | 'warning' | 'critical' | 'breached' } {
  const now = Date.now();
  const diff = deadlineMs - now;

  if (diff <= 0) {
    return { label: 'SLA breached', severity: 'breached' };
  }

  const totalMinutes = Math.floor(diff / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours >= 1) {
    return {
      label: `${hours}h ${minutes}m remaining`,
      severity: 'ok',
    };
  }

  if (totalMinutes >= 30) {
    return {
      label: `${totalMinutes}m remaining`,
      severity: 'warning',
    };
  }

  return {
    label: `${totalMinutes}m remaining`,
    severity: 'critical',
  };
}

const SEVERITY_STYLES: Record<string, { color: string; bg: string }> = {
  ok: { color: '#3D7A50', bg: '#E8F5E9' },
  warning: { color: '#C15B2E', bg: '#FFF3E0' },
  critical: { color: '#C15B2E', bg: '#FDEAE4' },
  breached: { color: '#fff', bg: '#C15B2E' },
};

export function SlaCountdown({ deadline }: SlaCountdownProps) {
  const deadlineMs = new Date(deadline).getTime();
  const [display, setDisplay] = useState(() => formatRemaining(deadlineMs));

  useEffect(() => {
    // Update immediately in case of SSR/hydration drift
    setDisplay(formatRemaining(deadlineMs));

    const interval = setInterval(() => {
      setDisplay(formatRemaining(deadlineMs));
    }, 60_000);

    return () => clearInterval(interval);
  }, [deadlineMs]);

  const style = SEVERITY_STYLES[display.severity];

  return (
    <Badge
      className="mt-1 text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {display.label}
    </Badge>
  );
}
