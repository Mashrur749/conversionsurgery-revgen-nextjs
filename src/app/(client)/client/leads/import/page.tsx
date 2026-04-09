import { redirect } from 'next/navigation';
import { getClientSession } from '@/lib/client-auth';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { requirePortalPagePermission } from '@/lib/permissions/require-portal-page-permission';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ImportWizard } from './import-wizard';

export const dynamic = 'force-dynamic';

export default async function LeadsImportPage() {
  await requirePortalPagePermission(PORTAL_PERMISSIONS.LEADS_EDIT);

  // Managed-service clients: operator imports leads, redirect to dashboard
  const session = await getClientSession();
  if (session) {
    const db = getDb();
    const [clientRow] = await db
      .select({ serviceModel: clients.serviceModel })
      .from(clients)
      .where(eq(clients.id, session.clientId))
      .limit(1);
    if (clientRow?.serviceModel === 'managed') {
      redirect('/client');
    }
  }

  const templateCsv =
    'data:text/csv;charset=utf-8,name,phone,email,projectType,status\n' +
    'John Smith,5551234567,john@example.com,Roof Replacement,estimate_sent\n' +
    'Jane Doe,5559876543,,Kitchen Remodel,new';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/client' },
          { label: 'Import Old Quotes' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold">Import Your Old Quotes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV of past leads to start automated follow-up for any quote set to
          &ldquo;estimate_sent&rdquo; — we&apos;ll begin the Day 2/5/10/14 text sequence right away.
        </p>
      </div>

      {/* Instructions */}
      <div className="bg-[#E3E9E1] rounded-lg p-4 text-sm space-y-2">
        <p className="font-medium text-forest">Required CSV columns</p>
        <ul className="space-y-1 text-muted-foreground list-disc list-inside">
          <li><span className="font-mono text-xs bg-white rounded px-1 py-0.5">phone</span> — required. US number, any format.</li>
          <li><span className="font-mono text-xs bg-white rounded px-1 py-0.5">name</span> — optional. Customer&apos;s full name.</li>
          <li><span className="font-mono text-xs bg-white rounded px-1 py-0.5">email</span> — optional.</li>
          <li><span className="font-mono text-xs bg-white rounded px-1 py-0.5">projectType</span> — optional. Roof, HVAC, Kitchen, etc.</li>
          <li>
            <span className="font-mono text-xs bg-white rounded px-1 py-0.5">status</span> — optional.
            {' '}Set to <span className="font-mono text-xs bg-white rounded px-1 py-0.5">estimate_sent</span> for old quotes to trigger follow-up.
            {' '}Defaults to <span className="font-mono text-xs bg-white rounded px-1 py-0.5">new</span>.
          </li>
        </ul>
        <a
          href={templateCsv}
          download="quote-import-template.csv"
          className="inline-flex items-center gap-1 text-[#1B2F26] underline underline-offset-2 font-medium"
        >
          Download template CSV
        </a>
      </div>

      <ImportWizard />
    </div>
  );
}
