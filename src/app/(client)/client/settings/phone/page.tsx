import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PhoneProvisioner } from './phone-provisioner';

export const dynamic = 'force-dynamic';

export default async function PhoneSettingsPage() {
  const session = await getClientSession();
  if (!session) redirect('/client-login');

  const db = getDb();
  const [client] = await db
    .select({ twilioNumber: clients.twilioNumber, businessName: clients.businessName })
    .from(clients)
    .where(eq(clients.id, session.clientId))
    .limit(1);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Business Phone Number</h1>
        <p className="text-muted-foreground">
          Your dedicated business line for automated SMS, voice AI, and lead communication.
        </p>
      </div>

      <PhoneProvisioner
        currentNumber={client?.twilioNumber || null}
        businessName={client?.businessName || ''}
      />
    </div>
  );
}
