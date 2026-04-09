import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clients, dailyStats } from '@/db/schema';
import { ne } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PhoneNumbersTable } from './components/phone-numbers-table';
import { PhoneNumbersStats } from './components/phone-numbers-stats';
import { getAccountBalance } from '@/lib/services/twilio-provisioning';

export default async function PhoneNumbersPage() {
  const session = await auth();

  if (!session?.user?.isAgency) {
    redirect('/dashboard');
  }

  const db = getDb();

  // Fetch Twilio balance (fail gracefully)
  let twilioBalance: string | null = null;
  try {
    const balance = await getAccountBalance();
    if (balance?.balance) {
      twilioBalance = parseFloat(balance.balance).toFixed(2);
    }
  } catch {
    // Twilio API unavailable — skip badge
  }

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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Phone Number Management</h1>
            {twilioBalance && (
              <Link
                href="/admin/twilio"
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-[#E3E9E1] text-[#1B2F26] hover:bg-[#C8D4CC] transition-colors"
              >
                Twilio Balance: ${twilioBalance}
              </Link>
            )}
          </div>
          <p className="text-muted-foreground mt-2">
            Manage all your Twilio phone numbers and client assignments
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/clients/new/wizard">+ Purchase Number</Link>
          </Button>
          <Button asChild>
            <Link href="/admin">&larr; Back to Dashboard</Link>
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
