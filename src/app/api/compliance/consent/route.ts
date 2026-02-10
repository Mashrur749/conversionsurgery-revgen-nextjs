import { NextRequest, NextResponse } from 'next/server';
import { getClientSession } from '@/lib/client-auth';
import { ComplianceService } from '@/lib/compliance/compliance-service';

export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as {
    phoneNumber?: string;
    type?: string;
    source?: string;
    language?: string;
    scope?: { marketing: boolean; transactional: boolean; promotional: boolean; reminders: boolean };
    formUrl?: string;
  };

  if (!body.phoneNumber || !body.type || !body.source || !body.language) {
    return NextResponse.json(
      { error: 'Missing required fields: phoneNumber, type, source, language' },
      { status: 400 }
    );
  }

  const consentId = await ComplianceService.recordConsent(
    session.clientId,
    body.phoneNumber,
    {
      type: body.type as 'express_written' | 'express_oral' | 'implied' | 'transactional',
      source: body.source as 'web_form' | 'text_optin' | 'paper_form' | 'phone_recording' | 'existing_customer' | 'manual_entry' | 'api_import',
      scope: body.scope || {
        marketing: true,
        transactional: true,
        promotional: true,
        reminders: true,
      },
      language: body.language,
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
      formUrl: body.formUrl,
    }
  );

  return NextResponse.json({ consentId });
}
