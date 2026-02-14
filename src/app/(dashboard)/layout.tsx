import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getDb, clients } from '@/db';
import { eq } from 'drizzle-orm';
import { ClientSelector } from '@/components/admin/client-selector';
import { AdminNav } from '@/components/admin/admin-nav';
import { SwitchingOverlay } from '@/components/admin/switching-overlay';
import { AdminProvider } from '@/lib/admin-context';
import { MobileNav } from '@/components/mobile-nav';
import SignOutButton from './signout-button';
import { HelpButton } from '@/components/ui/help-button';

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/leads', label: 'Leads' },
  { href: '/conversations', label: 'Conversations' },
  { href: '/escalations', label: 'Escalations' },
  { href: '/scheduled', label: 'Scheduled' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/settings', label: 'Settings' },
  { href: '/discussions', label: 'Discussions' },
];

const adminNavItems = [
  { group: 'Clients', items: [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/clients', label: 'Clients' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/agency', label: 'Communications' },
    { href: '/admin/discussions', label: 'Discussions' },
  ]},
  { group: 'Optimization', items: [
    { href: '/admin/flow-templates', label: 'Flow Templates' },
    { href: '/admin/analytics', label: 'Flow Analytics' },
    { href: '/admin/template-performance', label: 'Variant Results' },
    { href: '/admin/ab-tests', label: 'A/B Tests' },
    { href: '/admin/reputation', label: 'Reputation' },
  ]},
  { group: 'Reporting', items: [
    { href: '/admin/billing', label: 'Billing' },
    { href: '/admin/reports', label: 'Reports' },
    { href: '/admin/platform-analytics', label: 'Platform Health' },
    { href: '/admin/usage', label: 'Costs & Usage' },
  ]},
  { group: 'Settings', items: [
    { href: '/admin/phone-numbers', label: 'Phone Numbers' },
    { href: '/admin/twilio', label: 'Twilio Account' },
    { href: '/admin/voice-ai', label: 'Voice AI' },
    { href: '/admin/compliance', label: 'Compliance' },
  ]},
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const isAdmin = session.user?.isAdmin || false;

  let allClients: { id: string; businessName: string; ownerName: string }[] = [];
  if (isAdmin) {
    const db = getDb();
    allClients = await db
      .select({
        id: clients.id,
        businessName: clients.businessName,
        ownerName: clients.ownerName,
      })
      .from(clients)
      .where(eq(clients.status, 'active'))
      .orderBy(clients.businessName);
  }

  return (
    <AdminProvider>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between items-center h-14 lg:h-16">
              <div className="flex items-center gap-2 lg:gap-8">
                <MobileNav navItems={navItems} adminGroups={isAdmin ? adminNavItems : undefined} isAdmin={isAdmin} />
                <Link href="/dashboard" className="font-semibold text-base lg:text-lg">
                  Revenue Recovery
                </Link>
                <nav className="hidden lg:flex items-center gap-1">
                  {isAdmin ? (
                    <>
                      <ClientSelector clients={allClients} />
                      <AdminNav groups={[
                        { group: 'Client View', items: navItems },
                        ...adminNavItems,
                      ]} />
                    </>
                  ) : (
                    navItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))
                  )}
                </nav>
              </div>
              <div className="flex items-center gap-2 lg:gap-4">
                {!isAdmin && (
                  <span className="hidden lg:inline text-sm text-gray-600">
                    {session.client?.businessName || session.user?.email}
                  </span>
                )}
                <SignOutButton />
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-3 py-4 lg:px-4 lg:py-8">
          {isAdmin ? (
            <SwitchingOverlay>{children}</SwitchingOverlay>
          ) : (
            children
          )}
        </main>
        {!isAdmin && <HelpButton />}
      </div>
    </AdminProvider>
  );
}
