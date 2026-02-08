import { NextRequest, NextResponse } from 'next/server';
import { handleFormSubmission } from '@/lib/automations/form-response';
import { z } from 'zod';

const formSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().optional(),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  message: z.string().optional(),
  projectType: z.string().optional(),
  address: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = formSchema.parse(body);

    const result = await handleFormSubmission(payload);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Form webhook error:', error);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}
