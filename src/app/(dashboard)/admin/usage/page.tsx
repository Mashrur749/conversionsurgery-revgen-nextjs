import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UsageDashboard } from './components/usage-dashboard';

export default async function UsagePage() {
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Usage Tracking</h1>
      <UsageDashboard />
    </div>
  );
}
