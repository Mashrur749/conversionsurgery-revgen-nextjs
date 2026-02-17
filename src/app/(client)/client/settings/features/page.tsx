import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { FeatureTogglesForm } from './feature-toggles-form';

export default async function ClientFeaturesPage() {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const { client } = session;

  const defaults = {
    missedCallSmsEnabled: client.missedCallSmsEnabled ?? true,
    aiResponseEnabled: client.aiResponseEnabled ?? true,
    photoRequestsEnabled: client.photoRequestsEnabled ?? true,
    notificationEmail: client.notificationEmail ?? true,
    notificationSms: client.notificationSms ?? true,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Features</h1>
        <p className="text-sm text-muted-foreground">
          Control which features are active for your account
        </p>
      </div>
      <FeatureTogglesForm defaults={defaults} />
    </div>
  );
}
