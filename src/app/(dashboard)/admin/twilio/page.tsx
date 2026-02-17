import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { getAccountBalance, listOwnedNumbers } from '@/lib/services/twilio-provisioning';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default async function TwilioAdminPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const [balance, ownedNumbers] = await Promise.all([
    getAccountBalance(),
    listOwnedNumbers(),
  ]);

  // Get assigned numbers
  const db = getDb();
  const assignedClients = await db
    .select({
      twilioNumber: clients.twilioNumber,
      businessName: clients.businessName,
    })
    .from(clients)
    .where(eq(clients.status, 'active'));

  const assignedNumbers = new Set(
    assignedClients.map(c => c.twilioNumber).filter(Boolean)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Twilio Account</h1>
          <p className="text-muted-foreground">Manage your Twilio resources</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/clients">← Back to Clients</Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account Balance</CardTitle>
          </CardHeader>
          <CardContent>
            {balance ? (
              <>
                <div className="text-3xl font-bold">
                  {balance.currency} {parseFloat(balance.balance).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">Current Twilio balance</p>
              </>
            ) : (
              <p className="text-muted-foreground">Unable to fetch balance</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phone Numbers</CardTitle>
            <CardDescription>
              {ownedNumbers.length} owned, {assignedNumbers.size} assigned
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {ownedNumbers.length - assignedNumbers.size}
            </div>
            <p className="text-sm text-muted-foreground">available to assign</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Numbers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {ownedNumbers.map((num) => {
              const assignedTo = assignedClients.find(
                c => c.twilioNumber === num.phoneNumber
              );

              return (
                <div
                  key={num.sid}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-mono font-medium">
                      {formatPhoneNumber(num.phoneNumber)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {num.friendlyName}
                    </p>
                  </div>
                  {assignedTo ? (
                    <span className="text-sm text-green-600">
                      → {assignedTo.businessName}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Not assigned
                    </span>
                  )}
                </div>
              );
            })}
            {ownedNumbers.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No phone numbers in your Twilio account
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
