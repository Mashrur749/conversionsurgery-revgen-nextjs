import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { callAttempts, teamMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import twilio from 'twilio';
import { getWebhookBaseUrl } from '@/lib/utils/webhook-url';

const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * [Voice] Twilio webhook for ring group connection
 * Generates TwiML to ring all team members simultaneously
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const attemptId = url.searchParams.get('attemptId');
  const leadPhone = url.searchParams.get('leadPhone');

  if (!attemptId) {
    const twiml = new VoiceResponse();
    twiml.say('Sorry, there was an error connecting your call.');
    twiml.hangup();
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const db = getDb();

  const [attempt] = await db
    .select()
    .from(callAttempts)
    .where(eq(callAttempts.id, attemptId))
    .limit(1);

  if (!attempt) {
    const twiml = new VoiceResponse();
    twiml.say('Sorry, there was an error.');
    twiml.hangup();
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const members = await db
    .select()
    .from(teamMembers)
    .where(and(
      eq(teamMembers.clientId, attempt.clientId),
      eq(teamMembers.isActive, true),
      eq(teamMembers.receiveHotTransfers, true)
    ))
    .orderBy(teamMembers.priority);

  if (members.length === 0) {
    const twiml = new VoiceResponse();
    twiml.say('Sorry, no one is available to take your call right now. We will call you back shortly.');
    twiml.hangup();
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const twiml = new VoiceResponse();
  twiml.say({ voice: 'alice' }, 'Please hold while we connect you.');

  const appUrl = getWebhookBaseUrl(request);

  const dial = twiml.dial({
    timeout: 25,
    action: `${appUrl}/api/webhooks/twilio/ring-result?attemptId=${attemptId}`,
    callerId: leadPhone || undefined,
  });

  for (const member of members) {
    dial.number(
      {
        statusCallbackEvent: ['answered'],
        statusCallback: `${appUrl}/api/webhooks/twilio/member-answered?attemptId=${attemptId}&memberId=${member.id}`,
      },
      member.phone
    );
  }

  twiml.say({ voice: 'alice' }, 'Sorry, no one is available right now. We will call you back very shortly.');

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
