import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, withTransaction } from '@/db';
import { clients, people, clientMemberships, roleTemplates } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import {
  ensureDayOneMilestones,
  recordDayOneActivity,
} from '@/lib/services/day-one-activation';
import { safeErrorResponse } from '@/lib/utils/api-errors';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

const signupSchema = z.object({
  businessName: z.string().min(2).max(255),
  ownerName: z.string().min(2).max(255),
  email: z.string().email().max(255),
  phone: z.string().min(10).max(20),
  timezone: z.string().min(3).max(50).default('America/Edmonton'),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const normalizedPhone = normalizePhoneNumber(data.phone);
  const db = getDb();

  const [existingClient] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.email, data.email))
    .limit(1);

  if (existingClient) {
    return NextResponse.json(
      { error: 'An account with this email already exists. Please log in.' },
      { status: 409 }
    );
  }

  const [ownerTemplate] = await db
    .select({ id: roleTemplates.id })
    .from(roleTemplates)
    .where(
      and(
        eq(roleTemplates.slug, 'business_owner'),
        eq(roleTemplates.scope, 'client')
      )
    )
    .limit(1);

  if (!ownerTemplate) {
    return NextResponse.json(
      { error: 'Owner role template is missing. Contact support.' },
      { status: 500 }
    );
  }

  try {
    const client = await withTransaction(async (tx) => {
      const [createdClient] = await tx
        .insert(clients)
        .values({
          businessName: data.businessName,
          ownerName: data.ownerName,
          email: data.email,
          phone: normalizedPhone,
          timezone: data.timezone,
          status: 'pending',
        })
        .returning({
          id: clients.id,
          businessName: clients.businessName,
          createdAt: clients.createdAt,
        });

      let [person] = await tx
        .select({ id: people.id })
        .from(people)
        .where(eq(people.email, data.email))
        .limit(1);

      if (!person) {
        [person] = await tx
          .insert(people)
          .values({
            name: data.ownerName,
            email: data.email,
            phone: normalizedPhone,
          })
          .returning({ id: people.id });
      }

      await tx.insert(clientMemberships).values({
        personId: person.id,
        clientId: createdClient.id,
        roleTemplateId: ownerTemplate.id,
        isOwner: true,
        receiveEscalations: true,
        receiveHotTransfers: true,
      });

      return createdClient;
    });

    try {
      await ensureDayOneMilestones(client.id, new Date(client.createdAt!));
      await recordDayOneActivity({
        clientId: client.id,
        eventType: 'onboarding_started',
        actorType: 'client_owner',
        actorId: data.email,
        notes: 'Public self-serve signup created in pending state.',
        metadata: {
          source: 'public_signup',
        },
      });
    } catch (dayOneError) {
      logSanitizedConsoleError('[PublicSignup] Day-one initialization failed:', dayOneError, {
        clientId: client.id,
      });
    }

    return NextResponse.json(
      {
        success: true,
        clientId: client.id,
        message:
          'Signup received. Your workspace has been created in pending state. Complete setup with the onboarding flow.',
      },
      { status: 201 }
    );
  } catch (error) {
    return safeErrorResponse('[PublicSignup][signup.post]', error, 'Failed to create account. Please try again.');
  }
}
