import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getDb } from '@/db';
import { people, clientMemberships } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getClientSession } from '@/lib/client-auth';
import { CheckCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function WelcomePage() {
  const session = await getClientSession();
  if (!session) {
    redirect('/client-login');
  }

  // Only show welcome for new-format sessions (with personId)
  if (!('personId' in session)) {
    redirect('/client');
  }

  const db = getDb();

  // Check if this is the first login
  const [person] = await db
    .select({ lastLoginAt: people.lastLoginAt })
    .from(people)
    .where(eq(people.id, session.personId))
    .limit(1);

  if (!person || person.lastLoginAt !== null) {
    // Not first login - go to dashboard
    redirect('/client');
  }

  // Load membership to verify active access
  const [membership] = await db
    .select({ id: clientMemberships.id })
    .from(clientMemberships)
    .where(
      and(
        eq(clientMemberships.personId, session.personId),
        eq(clientMemberships.clientId, session.clientId),
        eq(clientMemberships.isActive, true)
      )
    )
    .limit(1);

  if (!membership) {
    redirect('/client-login');
  }

  // Fetch operator contact info
  const { getAgency } = await import('@/lib/services/agency-settings');
  const agency = await getAgency();

  // Update lastLoginAt so welcome is not shown again
  await db
    .update(people)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(people.id, session.personId));

  const operatorName = agency.operatorName ?? 'your account manager';
  const operatorPhone = agency.operatorPhone ?? null;

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl font-bold text-[#1B2F26]">
            Welcome to {session.client.businessName}
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Your AI assistant is set up and ready to help you win more jobs.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* What's already happening */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              What&apos;s already happening
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 size-5 shrink-0 text-[#3D7A50]" />
                <div>
                  <p className="text-sm font-medium text-[#1B2F26]">Missed calls get an instant text-back</p>
                  <p className="text-xs text-muted-foreground">Your business number is monitored around the clock</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 size-5 shrink-0 text-[#3D7A50]" />
                <div>
                  <p className="text-sm font-medium text-[#1B2F26]">Every lead gets a response in under 5 seconds</p>
                  <p className="text-xs text-muted-foreground">Faster than any competitor</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 size-5 shrink-0 text-[#3D7A50]" />
                <div>
                  <p className="text-sm font-medium text-[#1B2F26]">Old quotes are being followed up</p>
                  <p className="text-xs text-muted-foreground">If imported, the AI is reaching out to past leads</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Your first week */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Your first week
            </p>
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1B2F26] text-white text-xs font-semibold">
                  1
                </span>
                <p className="text-sm text-[#1B2F26]">
                  Check your <span className="font-medium">Dashboard</span> daily to see leads coming in
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1B2F26] text-white text-xs font-semibold">
                  2
                </span>
                <p className="text-sm text-[#1B2F26]">
                  Mark jobs as <span className="font-medium">Won</span> or <span className="font-medium">Complete</span> in Conversations to track your revenue
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1B2F26] text-white text-xs font-semibold">
                  3
                </span>
                <p className="text-sm text-[#1B2F26]">
                  <span className="font-medium">{operatorName}</span> is available
                  {operatorPhone ? (
                    <> at <span className="font-medium">{operatorPhone}</span></>
                  ) : null}{' '}
                  for any questions
                </p>
              </li>
            </ol>
          </div>
        </CardContent>

        <CardFooter>
          <Button asChild className="w-full" size="lg">
            <Link href="/client">Go to Dashboard</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
