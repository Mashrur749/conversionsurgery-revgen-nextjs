import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { users, clients } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const db = getDb();
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isAdmin: users.isAdmin,
      clientId: users.clientId,
      clientName: clients.businessName,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(clients, eq(users.clientId, clients.id))
    .orderBy(desc(users.createdAt));

  return NextResponse.json({ users: allUsers });
}
