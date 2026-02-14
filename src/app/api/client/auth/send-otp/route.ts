import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidPhoneNumber } from '@/lib/utils/phone';
import { createAndSendPhoneOTP, createAndSendEmailOTP } from '@/lib/services/otp';

const sendOtpSchema = z
  .object({
    identifier: z.string().min(1, 'Identifier is required'),
    method: z.enum(['phone', 'email']),
  })
  .strict();

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = sendOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { identifier, method } = parsed.data;

  // Validate phone format
  if (method === 'phone' && !isValidPhoneNumber(identifier)) {
    return NextResponse.json(
      { error: 'Invalid phone number' },
      { status: 400 }
    );
  }

  // Validate email format
  if (method === 'email' && !z.string().email().safeParse(identifier).success) {
    return NextResponse.json(
      { error: 'Invalid email address' },
      { status: 400 }
    );
  }

  try {
    const result =
      method === 'phone'
        ? await createAndSendPhoneOTP(identifier)
        : await createAndSendEmailOTP(identifier);

    if (!result.success && result.error === 'rate_limit') {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfterSeconds: result.retryAfterSeconds },
        { status: 429 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[OTP] Send error:', error);
    return NextResponse.json(
      { error: 'Failed to send code' },
      { status: 500 }
    );
  }
}
