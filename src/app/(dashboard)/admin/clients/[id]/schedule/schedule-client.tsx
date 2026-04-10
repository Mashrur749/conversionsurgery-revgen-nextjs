'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface TeamMember {
  id: string;
  name: string;
}

interface AppointmentRow {
  id: string;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes: number | null;
  address: string | null;
  status: string | null;
  leadName: string | null;
  leadPhone: string | null;
  projectType: string | null;
  assignedTeamMemberId: string | null;
  assignedMemberName: string | null;
}

interface DayGroup {
  dateLabel: string;        // e.g. "Mon Apr 14"
  isoDate: string;          // e.g. "2026-04-14"
  appointments: AppointmentRow[];
}

interface Props {
  clientId: string;
  days: DayGroup[];
  members: TeamMember[];
}

// Fixed palette of brand-safe colors for member badges
const MEMBER_BADGE_COLORS = [
  'bg-[#E8F5E9] text-[#3D7A50]',
  'bg-[#E3E9E1] text-[#1B2F26]',
  'bg-[#FFF3E0] text-[#6B7E54]',
  'bg-[#C8D4CC] text-[#1B2F26]',
  'bg-[#E3E9E1] text-[#6B7E54]',
];

function getMemberColor(memberId: string, members: TeamMember[]): string {
  const index = members.findIndex((m) => m.id === memberId);
  return MEMBER_BADGE_COLORS[index % MEMBER_BADGE_COLORS.length] ?? MEMBER_BADGE_COLORS[0];
}

function formatTime(timeStr: string): string {
  const [rawH, rawM] = timeStr.split(':');
  const hours = Number(rawH ?? 0);
  const minutes = Number(rawM ?? 0);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const period = h < 12 ? 'AM' : 'PM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m} ${period}`;
}

function AppointmentCard({
  appt,
  clientId,
  members,
  onReassigned,
}: {
  appt: AppointmentRow;
  clientId: string;
  members: TeamMember[];
  onReassigned: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const isUnassigned = !appt.assignedTeamMemberId;

  async function handleReassign(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const newMemberId = value === '' ? null : value;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/appointments/${appt.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignedTeamMemberId: newMemberId }),
        }
      );
      if (res.ok) {
        onReassigned();
      }
    } finally {
      setSaving(false);
    }
  }

  const badgeClass = isUnassigned
    ? 'bg-[#FDEAE4] text-[#C15B2E]'
    : getMemberColor(appt.assignedTeamMemberId!, members);

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 text-sm ${
        isUnassigned
          ? 'border-[#C15B2E]/30 bg-[#FDEAE4]/30'
          : 'border-border bg-white'
      }`}
    >
      {/* Time + duration */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-[#1B2F26]">
          {formatTime(appt.appointmentTime)}
        </span>
        {appt.durationMinutes && (
          <span className="text-xs text-muted-foreground">
            {appt.durationMinutes} min
          </span>
        )}
      </div>

      {/* Lead name */}
      <p className="font-medium truncate">
        {appt.leadName ?? 'Unknown Lead'}
      </p>

      {/* Project type */}
      {appt.projectType && (
        <p className="text-xs text-muted-foreground truncate">
          {appt.projectType}
        </p>
      )}

      {/* Address */}
      {appt.address && (
        <p className="text-xs text-muted-foreground truncate">
          {appt.address}
        </p>
      )}

      {/* Assigned member badge */}
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
      >
        {isUnassigned ? 'Unassigned' : (appt.assignedMemberName ?? 'Unknown')}
      </span>

      {/* Reassign dropdown */}
      <div>
        <select
          disabled={saving}
          defaultValue={appt.assignedTeamMemberId ?? ''}
          onChange={handleReassign}
          className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          aria-label="Reassign appointment"
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {saving && (
          <p className="text-xs text-muted-foreground mt-1">Saving&hellip;</p>
        )}
      </div>
    </div>
  );
}

export function ScheduleClient({ clientId, days, members }: Props) {
  const router = useRouter();

  function handleReassigned() {
    router.refresh();
  }

  const hasAnyAppointments = days.some((d) => d.appointments.length > 0);

  if (!hasAnyAppointments) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground mb-2">No appointments in the next 7 days.</p>
          <p className="text-sm text-muted-foreground">
            Appointments booked via SMS will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Desktop: 7-column grid */}
      <div className="hidden sm:grid sm:grid-cols-7 gap-3">
        {days.map((day) => (
          <div key={day.isoDate} className="flex flex-col gap-2">
            {/* Day header */}
            <div className="text-center">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {day.dateLabel.split(' ')[0]}
              </p>
              <p className="text-sm font-medium text-[#1B2F26]">
                {day.dateLabel.split(' ').slice(1).join(' ')}
              </p>
            </div>

            {/* Day column */}
            <div className="flex flex-col gap-2 min-h-[120px] rounded-lg border border-border/50 bg-[#F8F9FA] p-2">
              {day.appointments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center mt-4">
                  &mdash;
                </p>
              ) : (
                day.appointments.map((appt) => (
                  <AppointmentCard
                    key={appt.id}
                    appt={appt}
                    clientId={clientId}
                    members={members}
                    onReassigned={handleReassigned}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile: day-by-day cards */}
      <div className="sm:hidden space-y-4">
        {days.map((day) => (
          <div key={day.isoDate}>
            <p className="text-sm font-semibold text-[#1B2F26] mb-2">
              {day.dateLabel}
            </p>
            {day.appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground pl-1">No appointments</p>
            ) : (
              <div className="space-y-2">
                {day.appointments.map((appt) => (
                  <AppointmentCard
                    key={appt.id}
                    appt={appt}
                    clientId={clientId}
                    members={members}
                    onReassigned={handleReassigned}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
