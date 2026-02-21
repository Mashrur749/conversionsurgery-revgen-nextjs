import Link from 'next/link';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { SignupForm } from './signup-form';

export default async function SignupPage() {
  const session = await auth();
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] px-4 py-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-forest">ConversionSurgery</h1>
          <p className="text-muted-foreground mt-2">
            Self-serve onboarding is in beta. Managed service remains fully available.
          </p>
        </div>

        <SignupForm />

        <p className="text-center text-sm text-muted-foreground">
          Already have access? <Link href="/client-login" className="underline">Client Login</Link>
        </p>
      </div>
    </div>
  );
}
