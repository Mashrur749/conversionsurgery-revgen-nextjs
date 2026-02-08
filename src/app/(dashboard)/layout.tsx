import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import SignOutButton from './signout-button';
import { AdminProvider } from '@/lib/admin-context';

const clientNavItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/leads', label: 'Leads' },
  { href: '/conversations', label: 'Conversations' },
  { href: '/scheduled', label: 'Scheduled' },
  { href: '/settings', label: 'Settings' },
];

const adminNavItems = [
  { group: 'Management', items: [
    { href: '/admin', label: 'Agency Dashboard' },
    { href: '/admin/clients', label: 'Clients' },
  ]},
  { group: 'Optimization', items: [
    { href: '/admin/ab-tests', label: 'A/B Tests' },
    { href: '/admin/reports', label: 'Reports' },
  ]},
  { group: 'Configuration', items: [
    { href: '/admin/phone-numbers', label: 'Phone Numbers' },
    { href: '/admin/twilio', label: 'Twilio Settings' },
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

  const client = (session as any).client;
  const isAdmin = (session as any).user?.isAdmin;

  return (
    <AdminProvider>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-8">
                <Link href="/dashboard" className="font-semibold text-lg">
                  Revenue Recovery
                </Link>
                <nav className="hidden md:flex gap-1 flex-wrap">
                  {isAdmin ? (
                    // Admin navigation - grouped by feature area
                    <>
                      {adminNavItems.map((group, idx) => (
                        <div key={group.group} className="flex items-center">
                          {idx > 0 && <div className="border-l mx-2" />}
                          <div className="flex gap-0.5">
                            {group.items.map((item) => (
                              <Link
                                key={item.href}
                                href={item.href}
                                className="px-3 py-2 text-sm text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-md transition-colors whitespace-nowrap"
                                title={group.group}
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    // Client navigation
                    <>
                      {clientNavItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </>
                  )}
                </nav>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  {client?.businessName || session.user?.email}
                </span>
                <SignOutButton />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          {children}
        </main>
      </div>
    </AdminProvider>
  );
}
