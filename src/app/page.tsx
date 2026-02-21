import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <main className="max-w-5xl mx-auto px-6 py-20">
        <div className="space-y-8 text-center">
          <h1 className="text-5xl font-bold text-forest tracking-tight">
            ConversionSurgery
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Revenue recovery for home service businesses. Managed service today, self-serve onboarding now in beta.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button asChild>
              <Link href="/signup">Start Self-Serve Beta</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Agency Login</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/client-login">Client Login</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
