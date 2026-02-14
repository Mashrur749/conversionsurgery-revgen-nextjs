import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { HelpButton } from '@/components/ui/help-button';

const navItems = [
  { href: '/client', label: 'Dashboard' },
  { href: '/client/conversations', label: 'Conversations' },
  { href: '/client/revenue', label: 'Revenue' },
  { href: '/client/knowledge', label: 'Knowledge Base' },
  { href: '/client/flows', label: 'Flows' },
  { href: '/client/team', label: 'Team' },
  { href: '/client/billing', label: 'Billing' },
  { href: '/client/settings', label: 'Settings' },
  { href: '/client/help', label: 'Help' },
  { href: '/client/discussions', label: 'Discussions' },
];

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
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex justify-between items-center h-14">
            <span className="font-semibold text-sm truncate max-w-[200px]">
              {session.client.businessName}
            </span>
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        {children}
      </main>
      <HelpButton />
    </div>
  );
}
