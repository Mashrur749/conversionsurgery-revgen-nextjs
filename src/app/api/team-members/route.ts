import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { teamMembers } from '@/db/schema';
import { z } from 'zod';

const teamMemberSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  role: z.string().optional(),
  receiveEscalations: z.boolean().optional().default(true),
  receiveHotTransfers: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const data = await req.json();
    const validated = teamMemberSchema.parse(data);

    const db = getDb();
    const result = await db
      .insert(teamMembers)
      .values({
        clientId: validated.clientId,
        name: validated.name,
        phone: validated.phone,
        email: validated.email,
        role: validated.role,
        receiveEscalations: validated.receiveEscalations,
        receiveHotTransfers: validated.receiveHotTransfers,
      })
      .returning();

    return Response.json({ success: true, teamMember: result[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Team member creation error:', error);
    return Response.json({ error: 'Failed to create team member' }, { status: 500 });
  }
}
