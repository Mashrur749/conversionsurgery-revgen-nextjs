import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clients, dailyStats } from '@/db/schema';
import { ne } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PhoneNumbersTable } from './components/phone-numbers-table';
import { PhoneNumbersStats } from './components/phone-numbers-stats';

export default async function PhoneNumbersPage() {
  const session = await auth();

  if (!session?.user?.isAgency) {
    redirect('/dashboard');
  }

  const db = getDb();

  // Get all clients with phone numbers
  const allClients = await db.select().from(clients);

  const clientsWithNumbers = allClients.filter((c) => c.twilioNumber);
  const unassignedClients = allClients.filter(
    (c) => !c.twilioNumber && c.status !== 'cancelled'
  );

  // Get today's stats for all clients with numbers
  const today = new Date().toISOString().split('T')[0];
  const todayStats = await db
    .select()
    .from(dailyStats)
    .where(ne(dailyStats.date, today));

  // Enhance clients with stats
  const clientsWithStats = clientsWithNumbers.map((client) => {
    const stats = todayStats.find((s) => s.clientId === client.id);
    return {
      ...client,
      messagesSent: stats?.messagesSent || 0,
      missedCallsCaptured: stats?.missedCallsCaptured || 0,
    };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Phone Number Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage all your Twilio phone numbers and client assignments
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/clients/new/wizard">+ Purchase Number</Link>
          </Button>
          <Button asChild>
            <Link href="/admin">← Back to Dashboard</Link>
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <PhoneNumbersStats
        totalNumbers={clientsWithNumbers.length}
        assignedNumbers={clientsWithNumbers.length}
        availableForAssignment={unassignedClients.length}
        totalMessagesSent={clientsWithStats.reduce(
          (sum, c) => sum + (c.messagesSent || 0),
          0
        )}
        totalMissedCalls={clientsWithStats.reduce(
          (sum, c) => sum + (c.missedCallsCaptured || 0),
          0
        )}
      />

      {/* Phone Numbers Table */}
      <PhoneNumbersTable
        clients={clientsWithStats}
        unassignedClients={unassignedClients}
      />
    </div>
  );
}
