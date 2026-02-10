import { NextRequest, NextResponse } from 'next/server';
import { getClientSession } from '@/lib/client-auth';
import { ComplianceService } from '@/lib/compliance/compliance-service';

export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { phoneNumber, ...consent } = body;

  if (!phoneNumber || !consent.type || !consent.source || !consent.language) {
    return NextResponse.json(
      { error: 'Missing required fields: phoneNumber, type, source, language' },
      { status: 400 }
    );
  }

  const consentId = await ComplianceService.recordConsent(
    session.clientId,
    phoneNumber,
    {
      type: consent.type,
      source: consent.source,
      scope: consent.scope || {
        marketing: true,
        transactional: true,
        promotional: true,
        reminders: true,
      },
      language: consent.language,
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
      formUrl: consent.formUrl,
    }
  );

  return NextResponse.json({ consentId });
}
