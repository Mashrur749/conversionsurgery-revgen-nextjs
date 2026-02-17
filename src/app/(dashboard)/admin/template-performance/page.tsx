import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { TemplatePerformanceDashboard } from './components/template-performance-dashboard';

/**
 * Template Performance Dashboard Page
 * Displays aggregate performance metrics for all template variants
 */
export default async function TemplatePerformancePage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Template Performance</h1>
          <p className="mt-2 text-gray-600">
            Monitor and compare message template variants across all clients
          </p>
        </div>

        <TemplatePerformanceDashboard />
      </div>
    </div>
  );
}
