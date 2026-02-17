import { auth } from '@/auth';
import { getClientId } from '@/lib/get-client-id';
import { getDb, clients } from '@/db';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TeamMembersList } from './team-members-list';
import { BusinessHoursEditor } from './business-hours-editor';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await auth();
  const clientId = await getClientId();

  if (session?.user?.isAdmin && !clientId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold mb-2">Select a Client</h2>
        <p className="text-muted-foreground">
          Use the dropdown in the header to select a client to view.
        </p>
      </div>
    );
  }

  if (!clientId) {
    return <div>No client linked</div>;
  }

  const db = getDb();

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    return <div>Client not found</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Business Name</p>
              <p className="font-medium">{client.businessName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Owner Name</p>
              <p className="font-medium">{client.ownerName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{client.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{client.phone}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SMS Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Twilio Number</p>
              <p className="font-medium font-mono">
                {client.twilioNumber || 'Not configured'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Messages This Month</p>
              <p className="font-medium">
                {client.messagesSentThisMonth} / {client.monthlyMessageLimit}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Google Business URL</p>
              <p className="font-medium truncate">
                {client.googleBusinessUrl || 'Not set'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Email Notifications</span>
              <Badge variant={client.notificationEmail ? 'default' : 'secondary'}>
                {client.notificationEmail ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>SMS Notifications</span>
              <Badge variant={client.notificationSms ? 'default' : 'secondary'}>
                {client.notificationSms ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Form Webhook</CardTitle>
            <CardDescription>
              POST form submissions to this URL
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block p-3 bg-muted rounded text-sm break-all">
              {process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/form
            </code>
            <p className="text-sm text-muted-foreground mt-2">
              Include <code>clientId</code>, <code>phone</code>, and optionally{' '}
              <code>name</code>, <code>email</code>, <code>message</code>
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              People who receive escalation notifications when AI can&apos;t answer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeamMembersList clientId={clientId} />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Business Hours</CardTitle>
            <CardDescription>
              Set when hot transfers should connect calls immediately
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BusinessHoursEditor clientId={clientId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
