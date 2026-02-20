import { getDb, escalationClaims, leads } from '@/db';
import { eq } from 'drizzle-orm';
import { getTeamMemberById, getTeamMembers } from '@/lib/services/team-bridge';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
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
    const claimer = await getTeamMemberById(escalation.claimedBy!);

    redirect(`/claim-error?reason=claimed&by=${encodeURIComponent(claimer?.name || 'Someone')}`);
  }

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, escalation.leadId))
    .limit(1);

  const allMembers = await getTeamMembers(escalation.clientId);
  const members = allMembers.filter(m => m.isActive);

  return (
    <Card className="max-w-md mx-auto overflow-hidden border-0 shadow-2xl">
      <div className="bg-forest px-6 py-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 mb-3">
          <span className="text-xl font-bold text-white">C</span>
        </div>
        <h1 className="text-xl font-semibold text-white">Claim This Lead</h1>
        <p className="text-sm text-white/60 mt-1">
          Select your name to claim and respond to this lead
        </p>
      </div>
      <CardContent className="p-6 space-y-4">
        <div className="p-3 bg-[#F8F9FA] rounded-lg">
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
