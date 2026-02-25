import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { systemSettings } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { SystemSettingsManager } from './settings-manager';
import { CronCatchupManager } from './cron-catchup-manager';
import { ReliabilityDashboard } from './reliability-dashboard';

export const dynamic = 'force-dynamic';

export default async function SystemSettingsPage() {
  const session = await auth();
  if (!session?.user?.isAgency) redirect('/dashboard');

  const db = getDb();
  const settings = await db
    .select()
    .from(systemSettings)
    .orderBy(asc(systemSettings.key));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">Global configuration for the platform</p>
      </div>
      <ReliabilityDashboard />
      <CronCatchupManager />
      <SystemSettingsManager settings={settings} />
    </div>
  );
}
