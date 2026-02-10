import { NextRequest, NextResponse } from 'next/server';
import { getClientSession } from '@/lib/client-auth';
import { ComplianceService } from '@/lib/compliance/compliance-service';

export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { phoneNumber, messageType, recipientTimezone } = await req.json();

  if (!phoneNumber) {
    return NextResponse.json(
      { error: 'Phone number required' },
      { status: 400 }
    );
  }

  const result = await ComplianceService.checkCompliance(
    session.clientId,
    phoneNumber,
    messageType || 'marketing',
    recipientTimezone
  );

  return NextResponse.json(result);
}
