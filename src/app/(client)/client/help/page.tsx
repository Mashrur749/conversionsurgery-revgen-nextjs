import { Breadcrumbs } from '@/components/breadcrumbs';
import { HelpContent } from './help-content';

export default async function ClientHelpPage() {
  const { getAgency } = await import('@/lib/services/agency-settings');
  const agency = await getAgency();

  const operatorPhone = agency.operatorPhone ?? null;
  const operatorName = agency.operatorName ?? null;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/client' }, { label: 'Help' }]} />
      <div>
        <h1 className="text-2xl font-bold">Help Center</h1>
        <p className="text-muted-foreground">Find answers to common questions.</p>
      </div>

      <HelpContent operatorName={operatorName} operatorPhone={operatorPhone} />
    </div>
  );
}
