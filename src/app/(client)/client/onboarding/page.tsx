import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { requirePortalPagePermission } from '@/lib/permissions/require-portal-page-permission';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { KbWizard } from './kb-wizard';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  await requirePortalPagePermission(PORTAL_PERMISSIONS.KNOWLEDGE_EDIT);
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/client' },
          { label: 'Set Up Your AI' },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold text-[#1B2F26]">Set Up Your AI</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Answer 12 questions about your business (about 10 minutes). This trains the AI to answer homeowner questions on your behalf.
        </p>
      </div>
      <KbWizard />
    </div>
  );
}
