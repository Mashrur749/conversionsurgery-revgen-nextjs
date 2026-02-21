import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { SetupWizard } from './setup-wizard';

export default async function WizardPage() {
  const session = await auth();

  if (!session?.user?.isAgency) {
    redirect('/dashboard');
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <SetupWizard />
    </div>
  );
}
