import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function NewClientPage() {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Create New Client</h1>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">🧙‍♂️</div>
            <div>
              <h3 className="font-medium text-blue-900">Prefer guided setup?</h3>
              <p className="text-sm text-blue-700 mb-3">
                The Setup Wizard walks you through business info, phone number assignment,
                team members, and business hours in one smooth flow.
              </p>
              <Button asChild size="sm">
                <Link href="/admin/clients/new/wizard">
                  Start Setup Wizard
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
