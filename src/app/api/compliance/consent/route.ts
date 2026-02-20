import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getClientSession } from '@/lib/client-auth';
import { ComplianceService } from '@/lib/compliance/compliance-service';
import { safeErrorResponse } from '@/lib/utils/api-errors';

const consentScopeSchema = z.object({
  marketing: z.boolean(),
  transactional: z.boolean(),
  promotional: z.boolean(),
  reminders: z.boolean(),
});

const recordConsentSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  type: z.enum([
    'express_written',
    'express_oral',
    'implied',
    'transactional',
  ]),
  source: z.enum([
    'web_form',
    'text_optin',
    'paper_form',
    'phone_recording',
    'existing_customer',
    'manual_entry',
    'api_import',
  ]),
  language: z.string().min(1, 'Consent language is required'),
  scope: consentScopeSchema.optional().default({
    marketing: true,
    transactional: true,
    promotional: true,
    reminders: true,
  }),
  formUrl: z.string().url().optional(),
});

/** POST /api/compliance/consent - Record a new consent entry for a contact */
export async function POST(req: NextRequest) {
  try {
    const session = await getClientSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = recordConsentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { phoneNumber, type, source, language, scope, formUrl } = parsed.data;

    const consentId = await ComplianceService.recordConsent(
      session.clientId,
      phoneNumber,
      {
        type,
        source,
        scope,
        language,
        ipAddress: req.headers.get('x-forwarded-for') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
        formUrl,
      }
    );

    return NextResponse.json({ consentId });
  } catch (error: unknown) {
    return safeErrorResponse('[Compliance Consent]', error, 'Failed to record consent');
  }
}
