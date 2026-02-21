import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { WebhookLogViewer } from './webhook-log-viewer';

export default async function WebhookLogsPage() {
  const session = await auth();
  if (!session?.user?.isAgency) redirect('/dashboard');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Webhook Logs</h1>
        <p className="text-muted-foreground">View incoming webhook events from Twilio and other integrations.</p>
      </div>
      <WebhookLogViewer />
    </div>
  );
}
