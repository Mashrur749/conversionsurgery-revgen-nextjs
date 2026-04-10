import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb, clients, appointments, leads } from '@/db';
import { clientMemberships, people } from '@/db/schema';
import { eq, and, gte, lt, ne } from 'drizzle-orm';
import { format, addDays, startOfDay, parseISO } from 'date-fns';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { ScheduleClient } from './schedule-client';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SchedulePage({ params }: Props) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.isAgency) {
    redirect('/dashboard');
  }

  const db = getDb();

  const [client] = await db
    .select({ id: clients.id, businessName: clients.businessName })
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!client) {
    notFound();
  }

  // Fetch active team members
  const memberRows = await db
    .select({
      id: clientMemberships.id,
      name: people.name,
      isActive: clientMemberships.isActive,
    })
    .from(clientMemberships)
    .innerJoin(people, eq(clientMemberships.personId, people.id))
    .where(
      and(
        eq(clientMemberships.clientId, id),
        eq(clientMemberships.isActive, true)
      )
    )
    .orderBy(clientMemberships.priority);

  // Build 7-day window starting from today
  const today = startOfDay(new Date());
  const windowEnd = addDays(today, 7);
  const todayIso = format(today, 'yyyy-MM-dd');
  const windowEndIso = format(windowEnd, 'yyyy-MM-dd');

  // Fetch non-cancelled appointments in next 7 days
  const apptRows = await db
    .select({
      id: appointments.id,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      durationMinutes: appointments.durationMinutes,
      address: appointments.address,
      status: appointments.status,
      assignedTeamMemberId: appointments.assignedTeamMemberId,
      leadName: leads.name,
      leadPhone: leads.phone,
      projectType: leads.projectType,
    })
    .from(appointments)
    .innerJoin(leads, eq(leads.id, appointments.leadId))
    .where(
      and(
        eq(appointments.clientId, id),
        gte(appointments.appointmentDate, todayIso),
        lt(appointments.appointmentDate, windowEndIso),
        ne(appointments.status, 'cancelled')
      )
    )
    .orderBy(appointments.appointmentDate, appointments.appointmentTime);

  // Build member lookup for name resolution
  const memberMap = new Map(memberRows.map((m) => [m.id, m.name]));

  // Enrich appointments with assigned member name
  const enrichedAppts = apptRows.map((appt) => ({
    ...appt,
    assignedMemberName: appt.assignedTeamMemberId
      ? (memberMap.get(appt.assignedTeamMemberId) ?? null)
      : null,
  }));

  // Build 7-day groups
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    const isoDate = format(date, 'yyyy-MM-dd');
    const dateLabel = format(date, 'EEE MMM d');
    const dayAppts = enrichedAppts.filter((a) => a.appointmentDate === isoDate);
    return { dateLabel, isoDate, appointments: dayAppts };
  });

  const totalCount = enrichedAppts.length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Clients', href: '/admin/clients' },
          { label: client.businessName, href: `/admin/clients/${id}` },
          { label: 'Schedule' },
        ]}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold text-[#1B2F26]">
              Schedule &mdash; {client.businessName}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount} {totalCount === 1 ? 'appointment' : 'appointments'} in
            the next 7 days
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/clients/${id}`}>&larr; Back to Client</Link>
        </Button>
      </div>

      <ScheduleClient
        clientId={id}
        days={days}
        members={memberRows.map((m) => ({ id: m.id, name: m.name }))}
      />
    </div>
  );
}
