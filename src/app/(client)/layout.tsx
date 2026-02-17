import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { HelpButton } from '@/components/ui/help-button';
import { ClientNav } from '@/components/client-nav';

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getClientSession();

  if (!session) {
    redirect('/client-login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ClientNav businessName={session.client.businessName} />
      <main className="max-w-3xl mx-auto px-4 py-6">
        {children}
      </main>
      <HelpButton />
    </div>
  );
}
