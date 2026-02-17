import { getDb, escalationClaims, leads, teamMembers } from '@/db';
import { eq, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { ClaimForm } from './claim-form';

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ClaimPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    redirect('/claim-error?reason=invalid');
  }

  const db = getDb();

  const [escalation] = await db
    .select()
    .from(escalationClaims)
    .where(eq(escalationClaims.claimToken, token))
    .limit(1);

  if (!escalation) {
    redirect('/claim-error?reason=invalid');
  }

  if (escalation.status !== 'pending') {
    const [claimer] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, escalation.claimedBy!))
      .limit(1);

    redirect(`/claim-error?reason=claimed&by=${encodeURIComponent(claimer?.name || 'Someone')}`);
  }

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, escalation.leadId))
    .limit(1);

  const members = await db
    .select()
    .from(teamMembers)
    .where(and(
      eq(teamMembers.clientId, escalation.clientId),
      eq(teamMembers.isActive, true)
    ));

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Claim This Lead</CardTitle>
        <CardDescription>
          Select your name to claim and respond to this lead
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="font-medium">{lead?.name || formatPhoneNumber(lead?.phone || '')}</p>
          <p className="text-sm text-muted-foreground mt-1">
            &ldquo;{escalation.lastLeadMessage}&rdquo;
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Reason: {escalation.escalationReason}
          </p>
        </div>

        <ClaimForm token={token} members={members} leadId={lead?.id || ''} />
      </CardContent>
    </Card>
  );
}
