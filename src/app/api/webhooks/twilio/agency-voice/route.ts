import { NextRequest, NextResponse } from "next/server";
import { validateAndParseTwilioWebhook } from "@/lib/services/twilio";
import { logInternalError, logSanitizedConsoleError } from "@/lib/services/internal-error-log";
import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

function emptyTwiml() {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

/**
 * [Voice] Twilio voice webhook for agency number
 * Answers incoming calls with a message directing callers to text instead.
 * The agency number is for text messages only — voice calls are not supported.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await validateAndParseTwilioWebhook(request);
    if (!payload) {
      return emptyTwiml();
    }

    const from = payload.From;
    const to = payload.To;

    console.log("[Twilio Agency Voice] Webhook received", {
      fromSuffix: from ? from.slice(-4) : null,
      toSuffix: to ? to.slice(-4) : null,
    });

    if (!from || !to) {
      return emptyTwiml();
    }

    // Build TwiML response with greeting message
    const twiml = new VoiceResponse();
    twiml.say(
      { voice: "alice" },
      "This number is for text messages only. To reach our team, please send a text to this number. Goodbye."
    );
    twiml.hangup();

    console.log("[Twilio Agency Voice] Responding with text-only message", {
      fromSuffix: from.slice(-4),
      toSuffix: to.slice(-4),
    });

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    void logInternalError({
      source: "[Agency Voice] Webhook",
      error,
      context: { route: "/api/webhooks/twilio/agency-voice" },
    });
    logSanitizedConsoleError("[Agency Voice] Webhook error:", error, {
      route: "/api/webhooks/twilio/agency-voice",
    });
    return emptyTwiml();
  }
}
