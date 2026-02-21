import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { OnboardingChecklist } from './onboarding-checklist';

export default async function SignupNextStepsPage() {
  const session = await auth();
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] px-4 py-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-forest">Finish Your Setup</h1>
          <p className="text-muted-foreground mt-2">
            Complete the checklist to launch your workspace, or request managed onboarding help.
          </p>
        </div>

        <OnboardingChecklist />
      </div>
    </div>
  );
}
