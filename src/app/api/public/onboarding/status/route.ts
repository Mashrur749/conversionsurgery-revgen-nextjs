import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { businessHours, clientMemberships, clients, knowledgeBase } from '@/db/schema';
import { and, count, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId');
  const email = request.nextUrl.searchParams.get('email');

  if (!clientId || !email) {
    return NextResponse.json({ error: 'clientId and email are required' }, { status: 400 });
  }

  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.email, email)))
    .limit(1);

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const [hoursCount, kbCount, teamCount] = await Promise.all([
    db.select({ count: count() }).from(businessHours).where(eq(businessHours.clientId, clientId)),
    db.select({ count: count() }).from(knowledgeBase).where(eq(knowledgeBase.clientId, clientId)),
    db.select({ count: count() }).from(clientMemberships).where(eq(clientMemberships.clientId, clientId)),
  ]);

  const steps = [
    { key: 'workspace_created', title: 'Workspace created', done: true },
    { key: 'phone_provisioned', title: 'Business phone provisioned', done: !!client.twilioNumber },
    { key: 'business_hours', title: 'Business hours configured', done: Number(hoursCount[0]?.count || 0) > 0 },
    { key: 'knowledge_base', title: 'Knowledge base configured', done: Number(kbCount[0]?.count || 0) > 0 },
    { key: 'team_access', title: 'Team access configured', done: Number(teamCount[0]?.count || 0) > 1 },
  ];

  const completed = steps.filter((s) => s.done).length;

  return NextResponse.json({
    client: {
      id: client.id,
      businessName: client.businessName,
      status: client.status,
    },
    steps,
    progress: {
      completed,
      total: steps.length,
      percent: Math.round((completed / steps.length) * 100),
    },
    tutorials: [
      { title: 'Set up your business number', slug: 'business-number' },
      { title: 'Configure AI knowledge base', slug: 'knowledge-base' },
      { title: 'Invite your assistant/team', slug: 'team-setup' },
      { title: 'Review compliance settings', slug: 'compliance-basics' },
    ],
  });
}
