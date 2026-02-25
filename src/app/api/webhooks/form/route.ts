import { NextRequest, NextResponse } from 'next/server';
import { handleFormSubmission } from '@/lib/automations/form-response';
import { z } from 'zod';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { safeErrorResponse } from '@/lib/utils/api-errors';

const formSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().optional(),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  message: z.string().optional(),
  projectType: z.string().optional(),
  address: z.string().optional(),
});

/**
 * POST /api/webhooks/form
 * Handle form submission webhooks
 * Requires Authorization: Bearer <FORM_WEBHOOK_SECRET>
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.FORM_WEBHOOK_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = formSchema.safeParse(body);

    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors;
      logSanitizedConsoleError(
        '[Messaging][form-webhook.validation]',
        new Error('Invalid form payload'),
        { fieldErrors }
      );
      return NextResponse.json(
        { error: 'Invalid payload', details: fieldErrors },
        { status: 400 }
      );
    }

    const result = await handleFormSubmission(validation.data);

    console.log('[Messaging] Form submission processed successfully:', result);
    return NextResponse.json(result);
  } catch (error) {
    return safeErrorResponse('[Messaging][form-webhook.post]', error, 'Processing failed');
  }
}
