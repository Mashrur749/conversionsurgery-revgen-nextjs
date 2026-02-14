import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { systemSettings } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { SystemSettingsManager } from './settings-manager';

export const dynamic = 'force-dynamic';

export default async function SystemSettingsPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/dashboard');

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
      <SystemSettingsManager settings={settings} />
    </div>
  );
}
