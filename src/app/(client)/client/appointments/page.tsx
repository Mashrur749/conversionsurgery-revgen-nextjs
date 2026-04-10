import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb, appointments, leads } from '@/db';
import { eq, desc } from 'drizzle-orm';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { requirePortalPagePermission } from '@/lib/permissions/require-portal-page-permission';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { AppointmentCompleteButton } from './appointment-complete-button';

export default async function ClientAppointmentsPage() {
  await requirePortalPagePermission(PORTAL_PERMISSIONS.DASHBOARD);
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const { clientId } = session;
  const db = getDb();

  const rows = await db
    .select({
      id: appointments.id,
      appointmentDate: appointments.appointmentDate,
      appointmentTime: appointments.appointmentTime,
      address: appointments.address,
      status: appointments.status,
      leadName: leads.name,
      leadPhone: leads.phone,
    })
    .from(appointments)
    .innerJoin(leads, eq(leads.id, appointments.leadId))
    .where(eq(appointments.clientId, clientId))
    .orderBy(desc(appointments.appointmentDate));

  type StatusKey = 'scheduled' | 'confirmed' | 'completed' | 'no_show' | 'cancelled';

  const statusConfig: Record<StatusKey, { label: string; className: string }> = {
    scheduled: {
      label: 'Scheduled',
      className: 'bg-[#E3E9E1] text-[#1B2F26]',
    },
    confirmed: {
      label: 'Confirmed',
      className: 'bg-[#E8F5E9] text-[#3D7A50]',
    },
    completed: {
      label: 'Completed',
      className: 'bg-[#E8F5E9] text-[#3D7A50]',
    },
    no_show: {
      label: 'No Show',
      className: 'bg-[#FDEAE4] text-[#C15B2E]',
    },
    cancelled: {
      label: 'Cancelled',
      className: 'bg-muted text-foreground',
    },
  };

  function getStatusConfig(status: string | null) {
    const key = (status ?? 'scheduled') as StatusKey;
    return statusConfig[key] ?? statusConfig.scheduled;
  }

  function formatAppointmentTime(timeStr: string) {
    // time is HH:MM:SS from the database
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    return format(d, 'h:mm a');
  }

  const isActionable = (status: string | null) =>
    status === 'scheduled' || status === 'confirmed';

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/client' }, { label: 'Appointments' }]} />

      <div>
        <h1 className="text-2xl font-bold">Appointments</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? 'appointment' : 'appointments'} total
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-2">No appointments yet.</p>
            <p className="text-sm text-muted-foreground">
              When leads book through SMS, they&apos;ll appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="sm:hidden space-y-3">
            {rows.map((appt) => {
              const cfg = getStatusConfig(appt.status);
              const actionable = isActionable(appt.status);
              return (
                <Card key={appt.id}>
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {appt.leadName ?? 'Unknown Lead'}
                        </p>
                        <p className="text-xs text-muted-foreground">{appt.leadPhone}</p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${cfg.className}`}
                      >
                        {cfg.label}
                      </span>
                    </div>

                    <div className="text-sm">
                      <p className="font-medium">
                        {format(parseISO(appt.appointmentDate), 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className="text-muted-foreground">
                        {formatAppointmentTime(appt.appointmentTime)}
                      </p>
                      {appt.address && (
                        <p className="text-muted-foreground mt-0.5 truncate">{appt.address}</p>
                      )}
                    </div>

                    {actionable && (
                      <AppointmentCompleteButton
                        appointmentId={appt.id}
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop table layout */}
          <div className="hidden sm:block">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-[#F8F9FA]">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date &amp; Time</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Lead</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Address</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((appt) => {
                      const cfg = getStatusConfig(appt.status);
                      const actionable = isActionable(appt.status);
                      return (
                        <tr key={appt.id} className="hover:bg-[#F8F9FA] transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-medium">
                              {format(parseISO(appt.appointmentDate), 'MMM d, yyyy')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatAppointmentTime(appt.appointmentTime)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{appt.leadName ?? 'Unknown Lead'}</p>
                            <p className="text-xs text-muted-foreground">{appt.leadPhone}</p>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                            {appt.address ?? <span className="text-muted-foreground/50">&mdash;</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}
                            >
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {actionable && (
                              <AppointmentCompleteButton
                                appointmentId={appt.id}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
