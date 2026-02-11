import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getClientSession } from '@/lib/client-auth';
import { ComplianceService } from '@/lib/compliance/compliance-service';

const complianceCheckSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  messageType: z.enum(['marketing', 'transactional']).default('marketing'),
  recipientTimezone: z.string().optional(),
});

/** POST /api/compliance/check - Check if a phone number can receive a message */
export async function POST(req: NextRequest) {
  try {
    const session = await getClientSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = complianceCheckSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { phoneNumber, messageType, recipientTimezone } = parsed.data;

    const result = await ComplianceService.checkCompliance(
      session.clientId,
      phoneNumber,
      messageType,
      recipientTimezone
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Compliance Check] Failed to check compliance:', message);
    return NextResponse.json(
      { error: 'Failed to check compliance' },
      { status: 500 }
    );
  }
}
