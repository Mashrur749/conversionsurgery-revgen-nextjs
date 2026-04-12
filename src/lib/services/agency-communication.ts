import twilio from "twilio";
import { getDb } from "@/db";
import {
  agencyMessages,
  clients,
  leads,
  dailyStats,
  notificationPreferences,
} from "@/db/schema";
import { eq, and, desc, gte, lte, lt, sql, inArray } from "drizzle-orm";
import { isNumberedReply, parseNumberedReply } from "./numbered-reply-parser";
import type { NumberedSelection } from "./numbered-reply-parser";
import {
  sendEmail,
  onboardingWelcomeEmail,
  agencyWeeklyDigestEmail,
} from "./resend";
import { triggerEstimateFollowup } from "./estimate-triggers";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
);

// ---------------------------------------------------------------------------
// Agency number helper
// ---------------------------------------------------------------------------

/** Read the agency Twilio number from the agencies table. */
export async function getAgencyNumber(): Promise<string | null> {
  const { getAgencyField } = await import('@/lib/services/agency-settings');
  return await getAgencyField('twilioNumber') ?? null;
}

// ---------------------------------------------------------------------------
// Quiet hours check
// ---------------------------------------------------------------------------

async function isInQuietHours(
  clientId: string,
  isUrgent = false,
): Promise<boolean> {
  const db = getDb();
  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.clientId, clientId))
    .limit(1);

  if (!prefs?.quietHoursEnabled) return false;
  if (isUrgent && prefs.urgentOverride) return false;

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const start = prefs.quietHoursStart;
  const end = prefs.quietHoursEnd;

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (start > end) {
    return currentTime >= start || currentTime < end;
  }
  return currentTime >= start && currentTime < end;
}

// ---------------------------------------------------------------------------
// Send SMS via agency number
// ---------------------------------------------------------------------------

async function sendAgencySMS(params: {
  clientId: string;
  toPhone: string;
  body: string;
  category: string;
  promptType?: string;
  actionPayload?: Record<string, unknown>;
  expiresAt?: Date;
  inReplyTo?: string;
}): Promise<string | null> {
  const agencyNumber = await getAgencyNumber();
  if (!agencyNumber) {
    console.error("[Agency] No agency number configured");
    return null;
  }

  const db = getDb();

  try {
    const message = await twilioClient.messages.create({
      to: params.toPhone,
      from: agencyNumber,
      body: params.body,
    });

    const [inserted] = await db
      .insert(agencyMessages)
      .values({
        clientId: params.clientId,
        direction: "outbound",
        channel: "sms",
        content: params.body,
        category: params.category,
        promptType: params.promptType ?? null,
        actionPayload: params.actionPayload ?? null,
        actionStatus: params.promptType ? "pending" : null,
        inReplyTo: params.inReplyTo ?? null,
        twilioSid: message.sid,
        delivered: true,
        expiresAt: params.expiresAt ?? null,
      })
      .returning();

    console.log(`[Agency] SMS sent to ${params.toPhone}: ${message.sid}`);
    return inserted.id;
  } catch (error) {
    console.error("[Agency] Failed to send SMS:", error);

    // Still log the attempt
    await db
      .insert(agencyMessages)
      .values({
        clientId: params.clientId,
        direction: "outbound",
        channel: "sms",
        content: params.body,
        category: params.category,
        promptType: params.promptType ?? null,
        actionPayload: params.actionPayload ?? null,
        actionStatus: params.promptType ? "pending" : null,
        delivered: false,
      })
      .catch(() => {});

    return null;
  }
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

/** Send welcome SMS + email when a client is activated. */
export async function sendOnboardingNotification(
  clientId: string,
): Promise<void> {
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    console.error(`[Agency] Client not found: ${clientId}`);
    return;
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://app.conversionsurgery.com";
  const loginUrl = `${appUrl}/login`;

  // Send welcome SMS
  if (client.phone) {
    const smsBody = `Welcome to ConversionSurgery, ${client.ownerName}!\n\nYour account for ${client.businessName} is now active.\n\nLog in: ${loginUrl}\n\nWe'll handle your missed calls, follow-ups, and reviews.`;

    await sendAgencySMS({
      clientId: client.id,
      toPhone: client.phone,
      body: smsBody,
      category: "onboarding",
    });
  }

  // Send welcome email
  if (client.email) {
    const emailData = onboardingWelcomeEmail({
      ownerName: client.ownerName,
      businessName: client.businessName,
      loginUrl,
    });

    const result = await sendEmail({
      to: client.email,
      subject: emailData.subject,
      html: emailData.html,
    });

    // Log email in agency_messages
    await db
      .insert(agencyMessages)
      .values({
        clientId: client.id,
        direction: "outbound",
        channel: "email",
        content: emailData.html,
        subject: emailData.subject,
        category: "onboarding",
        delivered: result.success,
      })
      .catch(() => {});
  }

  console.log(
    `[Agency] Onboarding notification sent for client: ${client.businessName}`,
  );
}

// ---------------------------------------------------------------------------
// Action Prompts
// ---------------------------------------------------------------------------

/** Send an interactive prompt that the client can reply YES/NO to. */
export async function sendActionPrompt(params: {
  clientId: string;
  promptType: string;
  message: string;
  actionPayload: Record<string, unknown>;
  expiresInHours?: number;
}): Promise<string | null> {
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, params.clientId))
    .limit(1);

  if (!client?.phone) return null;

  // Check quiet hours
  if (await isInQuietHours(params.clientId)) {
    console.log(
      `[Agency] Skipping prompt for ${client.businessName} — quiet hours`,
    );
    return null;
  }

  // Expire any existing pending prompts for this client
  await db
    .update(agencyMessages)
    .set({ actionStatus: "expired" })
    .where(
      and(
        eq(agencyMessages.clientId, params.clientId),
        eq(agencyMessages.actionStatus, "pending"),
      ),
    );

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (params.expiresInHours ?? 24));

  return sendAgencySMS({
    clientId: params.clientId,
    toPhone: client.phone,
    body: params.message,
    category: "action_prompt",
    promptType: params.promptType,
    actionPayload: params.actionPayload,
    expiresAt,
  });
}

/** Send a non-interactive alert to a client. */
export async function sendAlert(params: {
  clientId: string;
  message: string;
  isUrgent?: boolean;
}): Promise<void> {
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, params.clientId))
    .limit(1);

  if (!client?.phone) return;

  // Check quiet hours (urgent can override)
  if (await isInQuietHours(params.clientId, params.isUrgent)) {
    console.log(
      `[Agency] Skipping alert for ${client.businessName} — quiet hours`,
    );
    return;
  }

  await sendAgencySMS({
    clientId: params.clientId,
    toPhone: client.phone,
    body: params.message,
    category: "alert",
  });
}

// ---------------------------------------------------------------------------
// Inbound reply handling
// ---------------------------------------------------------------------------

/** Handle an inbound SMS from a client to the agency number. */
export async function handleAgencyInboundSMS(payload: {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
}): Promise<void> {
  const db = getDb();
  const fromPhone = payload.From;
  const body = payload.Body.trim();

  // Look up client by their personal phone number
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.phone, fromPhone))
    .limit(1);

  if (!client) {
    console.log(`[Agency Inbound] No client found for phone: ${fromPhone}`);
    return;
  }

  // Log the inbound message
  const [inboundMsg] = await db
    .insert(agencyMessages)
    .values({
      clientId: client.id,
      direction: "inbound",
      channel: "sms",
      content: body,
      category: "reply",
      twilioSid: payload.MessageSid,
      delivered: true,
    })
    .returning();

  // Find most recent pending prompt for this client
  const [pendingPrompt] = await db
    .select()
    .from(agencyMessages)
    .where(
      and(
        eq(agencyMessages.clientId, client.id),
        eq(agencyMessages.actionStatus, "pending"),
        gte(agencyMessages.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(agencyMessages.createdAt))
    .limit(1);

  const normalizedReply = body.toUpperCase();

  if (!pendingPrompt) {
    console.log(
      `[Agency Inbound] No pending prompt for client: ${client.businessName}`,
    );
    if (normalizedReply === "YES" || normalizedReply === "Y") {
      await notifyPromptFallback(
        client.id,
        client.businessName,
        body,
        "expired_or_missing_prompt",
      );
      await sendAgencySMS({
        clientId: client.id,
        toPhone: client.phone,
        body: "This approval request has expired. Our team has been notified to handle it manually.",
        category: "reply",
        inReplyTo: inboundMsg.id,
      });
      return;
    }

    // Send generic acknowledgment
    await sendAgencySMS({
      clientId: client.id,
      toPhone: client.phone,
      body: `Thanks for your message. Our team will follow up shortly.`,
      category: "reply",
      inReplyTo: inboundMsg.id,
    });
    return;
  }

  // Update inbound message to reference the prompt
  await db
    .update(agencyMessages)
    .set({ inReplyTo: pendingPrompt.id })
    .where(eq(agencyMessages.id, inboundMsg.id));

  // ── Handle won_revenue_entry: numeric reply updates confirmed revenue ──
  if (
    pendingPrompt.promptType === "won_revenue_entry" &&
    /^\d[\d,.\s]*$/.test(body.trim())
  ) {
    const raw = body.replace(/[,\s]/g, "").replace(/\..*$/, ""); // strip decimals/commas
    const dollars = parseInt(raw, 10);
    const leadId =
      typeof (pendingPrompt.actionPayload as Record<string, unknown>)?.leadId === "string"
        ? ((pendingPrompt.actionPayload as Record<string, unknown>).leadId as string)
        : null;

    if (leadId && !isNaN(dollars) && dollars > 0) {
      const db2 = getDb();
      await db2
        .update(leads)
        .set({ confirmedRevenue: dollars * 100, updatedAt: new Date() }) // stored in cents
        .where(and(eq(leads.id, leadId), eq(leads.clientId, client.id)));

      await db2
        .update(agencyMessages)
        .set({ actionStatus: "executed", clientReply: body })
        .where(eq(agencyMessages.id, pendingPrompt.id));

      await sendAgencySMS({
        clientId: client.id,
        toPhone: client.phone,
        body: `Logged. Job value set to $${dollars.toLocaleString()} for this lead. Thanks!`,
        category: "reply",
        inReplyTo: pendingPrompt.id,
      });
    } else {
      await sendAgencySMS({
        clientId: client.id,
        toPhone: client.phone,
        body: `Could not read that amount. Please reply with a whole number (e.g. 55000).`,
        category: "reply",
        inReplyTo: pendingPrompt.id,
      });
    }
    return;
  }

  // ── Handle S/SKIP for revenue entry (skip recording job value) ──
  if (
    pendingPrompt.promptType === "won_revenue_entry" &&
    (normalizedReply === "S" || normalizedReply === "SKIP")
  ) {
    await db
      .update(agencyMessages)
      .set({ actionStatus: "replied", clientReply: body })
      .where(eq(agencyMessages.id, pendingPrompt.id));

    await sendAgencySMS({
      clientId: client.id,
      toPhone: client.phone,
      body: "Skipped. Using your average job value for reporting.",
      category: "reply",
      inReplyTo: pendingPrompt.id,
    });
    return;
  }

  // ── Handle numbered reply against pending prompt options ──
  const payloadOptions = extractPromptOptions(pendingPrompt.actionPayload);
  if (payloadOptions.length > 0 && isNumberedReply(body)) {
    const parsed = parseNumberedReply(body, payloadOptions.length);
    if (parsed.matched) {
      const result = await executeNumberedReply(
        client.id,
        client.phone,
        pendingPrompt,
        payloadOptions,
        parsed,
        inboundMsg.id,
      );
      if (result) return;
    }
  }

  // ── Handle "1" / "2" as YES / NO for binary prompts (no numbered options) ──
  if (payloadOptions.length === 0 && (normalizedReply === "1" || normalizedReply === "2")) {
    // Treat "1" as YES and "2" as NO for any pending prompt
    const syntheticReply = normalizedReply === "1" ? "YES" : "NO";
    // Fall through to YES/NO handlers below by overriding normalizedReply
    // (handled inline to avoid duplicating the YES/NO logic)
    return handleAgencyYesNoReply(
      client,
      pendingPrompt,
      inboundMsg.id,
      syntheticReply,
      body,
    );
  }

  // Handle STOP/opt-out
  if (normalizedReply === "STOP") {
    await db
      .update(agencyMessages)
      .set({ actionStatus: "replied", clientReply: body })
      .where(eq(agencyMessages.id, pendingPrompt.id));
    // Twilio handles STOP automatically — no reply needed
    console.log(`[Agency Inbound] Client ${client.businessName} opted out`);
    return;
  }

  // Handle YES/Y
  if (normalizedReply === "YES" || normalizedReply === "Y") {
    return handleAgencyYesNoReply(client, pendingPrompt, inboundMsg.id, "YES", body);
  }

  // Handle NO/N
  if (normalizedReply === "NO" || normalizedReply === "N") {
    return handleAgencyYesNoReply(client, pendingPrompt, inboundMsg.id, "NO", body);
  }

  // Any other reply — store but don't execute
  await db
    .update(agencyMessages)
    .set({ actionStatus: "replied", clientReply: body })
    .where(eq(agencyMessages.id, pendingPrompt.id));

  await sendAgencySMS({
    clientId: client.id,
    toPhone: client.phone,
    body: `Got it — our team will review your response.`,
    category: "reply",
    inReplyTo: pendingPrompt.id,
  });
}

interface PromptActionResult {
  ackMessage: string;
}

type PromptActionHandler = (
  actionPayload: Record<string, unknown>,
  clientId: string,
) => Promise<PromptActionResult>;

async function resolveSequenceTargetLeadIds(
  clientId: string,
  actionPayload: Record<string, unknown>,
): Promise<string[]> {
  if (
    typeof actionPayload.leadId === "string" &&
    actionPayload.leadId.length > 0
  ) {
    return [actionPayload.leadId];
  }

  if (Array.isArray(actionPayload.leadIds)) {
    const leadIds = actionPayload.leadIds.filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    if (leadIds.length > 0) {
      return leadIds;
    }
  }

  // Fallback for digest-level prompts: queue sequence starts for contacted leads.
  const db = getDb();
  const candidates = await db
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(eq(leads.clientId, clientId), inArray(leads.status, ["contacted"])),
    )
    .limit(25);

  return candidates.map((lead) => lead.id);
}

async function handleStartSequencesPrompt(
  actionPayload: Record<string, unknown>,
  clientId: string,
): Promise<PromptActionResult> {
  const leadIds = await resolveSequenceTargetLeadIds(clientId, actionPayload);
  if (leadIds.length === 0) {
    throw new Error(
      "No eligible leads available to start estimate follow-up sequences",
    );
  }

  let started = 0;
  let alreadyActive = 0;
  let failed = 0;

  for (const leadId of leadIds) {
    const result = await triggerEstimateFollowup({
      clientId,
      leadId,
      source: "prompt_quick_reply",
    });

    if (!result.success) {
      failed++;
      continue;
    }

    if (result.alreadyActive) {
      alreadyActive++;
      continue;
    }

    started++;
  }

  if (started + alreadyActive === 0) {
    throw new Error("Unable to start sequences from prompt action");
  }

  if (failed > 0) {
    return {
      ackMessage: `Done. Started ${started} sequence(s), ${alreadyActive} already active, ${failed} failed and need review.`,
    };
  }

  return {
    ackMessage: `Done. Started ${started} estimate sequence(s), ${alreadyActive} already active.`,
  };
}

async function handleConfirmActionPrompt(
  _actionPayload: Record<string, unknown>,
  _clientId: string,
): Promise<PromptActionResult> {
  return {
    ackMessage: "Done. Confirmation received and logged.",
  };
}

async function handleScheduleCallbackPrompt(
  _actionPayload: Record<string, unknown>,
  _clientId: string,
): Promise<PromptActionResult> {
  throw new Error("schedule_callback requires callback scheduler integration");
}

/**
 * Handle YES reply to a won/lost nudge.
 * Marks the lead as won and sends a follow-up prompt asking for revenue.
 */
async function handleWonLostNudgeYesPrompt(
  actionPayload: Record<string, unknown>,
  clientId: string,
): Promise<PromptActionResult> {
  const leadId = actionPayload.leadId;
  if (typeof leadId !== "string" || !leadId) {
    throw new Error("won_lost_nudge: missing leadId in actionPayload");
  }

  const db = getDb();

  // Mark lead as won
  await db
    .update(leads)
    .set({ status: "won", updatedAt: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.clientId, clientId)));

  // Immediately send a revenue follow-up prompt (the sendActionPrompt call
  // happens here so we can return ackMessage from the same execution path)
  const [client] = await db
    .select({ phone: clients.phone })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (client?.phone) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    await db.insert(agencyMessages).values({
      clientId,
      direction: "outbound",
      channel: "sms",
      content: "Great! What was the job value? Reply with the amount (e.g. 55000)",
      category: "action_prompt",
      promptType: "won_revenue_entry",
      actionPayload: { leadId },
      actionStatus: "pending",
      expiresAt,
    });

    // Send via Twilio
    const twilioClient = (await import("twilio")).default(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!,
    );
    const agencyNumber = await getAgencyNumber();
    if (agencyNumber) {
      try {
        const msg = await twilioClient.messages.create({
          to: client.phone,
          from: agencyNumber,
          body: "Great! What was the job value? Reply with the amount (e.g. 55000)",
        });
        // Update the inserted record with the Twilio SID
        await db
          .update(agencyMessages)
          .set({ twilioSid: msg.sid, delivered: true })
          .where(
            and(
              eq(agencyMessages.clientId, clientId),
              eq(agencyMessages.promptType, "won_revenue_entry"),
              eq(agencyMessages.actionStatus, "pending"),
            ),
          );
      } catch {
        // Non-fatal — the prompt record exists and can be answered later
      }
    }
  }

  return { ackMessage: "" }; // ackMessage is handled by the revenue prompt above
}

/**
 * Handle YES reply to a won_revenue_entry prompt.
 * The actual revenue update is handled inline in handleAgencyInboundSMS
 * because the reply is numeric, not YES/NO. This handler is a no-op fallback.
 */
async function handleWonRevenueEntryPrompt(
  _actionPayload: Record<string, unknown>,
  _clientId: string,
): Promise<PromptActionResult> {
  // Numeric replies are intercepted before executePromptAction is called.
  // This handler only fires if someone replies YES to a revenue prompt — treat
  // it as a prompt for a specific number.
  return {
    ackMessage: "Please reply with a number for the job value (e.g. 55000).",
  };
}

// ---------------------------------------------------------------------------
// Numbered reply helpers
// ---------------------------------------------------------------------------

interface PromptOption {
  index: number;
  leadId: string;
  label: string;
  action?: string; // e.g., 'start_estimate', 'skip'
}

function extractPromptOptions(
  actionPayload: unknown,
): PromptOption[] {
  if (!actionPayload || typeof actionPayload !== "object") return [];
  const payload = actionPayload as Record<string, unknown>;
  if (!Array.isArray(payload.options)) return [];
  return payload.options.filter(
    (opt): opt is PromptOption =>
      typeof opt === "object" &&
      opt !== null &&
      typeof (opt as Record<string, unknown>).index === "number" &&
      typeof (opt as Record<string, unknown>).leadId === "string",
  );
}

/**
 * Execute a numbered reply against a prompt with options.
 * Returns true if the reply was handled, false to fall through.
 */
async function executeNumberedReply(
  clientId: string,
  clientPhone: string,
  pendingPrompt: { id: string; promptType: string | null; actionPayload: unknown },
  options: PromptOption[],
  parsed: { skipAll: boolean; selections: NumberedSelection[] },
  inboundMsgId: string,
): Promise<boolean> {
  const db2 = getDb();

  // Skip all
  if (parsed.skipAll) {
    await db2
      .update(agencyMessages)
      .set({ actionStatus: "replied", clientReply: "0" })
      .where(eq(agencyMessages.id, pendingPrompt.id));

    await sendAgencySMS({
      clientId,
      toPhone: clientPhone,
      body: "Skipped. We'll check back next week.",
      category: "reply",
      inReplyTo: pendingPrompt.id,
    });
    return true;
  }

  const interactionType =
    typeof (pendingPrompt.actionPayload as Record<string, unknown>)
      ?.interactionType === "string"
      ? ((pendingPrompt.actionPayload as Record<string, unknown>)
          .interactionType as string)
      : null;

  // ── probable_wins_batch: W/L selections ──
  if (interactionType === "probable_wins_batch") {
    const wonLeads: string[] = [];
    const lostLeads: string[] = [];
    const selectedLabels: string[] = [];

    for (const sel of parsed.selections) {
      const opt = options.find((o) => o.index === sel.index);
      if (!opt) continue;

      const action = sel.action === "select" ? "won" : sel.action;

      if (action === "won") {
        await db2
          .update(leads)
          .set({ status: "won", updatedAt: new Date() })
          .where(and(eq(leads.id, opt.leadId), eq(leads.clientId, clientId)));
        wonLeads.push(opt.leadId);
        selectedLabels.push(`${opt.label} = Won`);

        // Trigger review request (non-blocking)
        try {
          const { startReviewRequest } = await import(
            "@/lib/automations/review-request"
          );
          startReviewRequest({ leadId: opt.leadId, clientId }).catch(() => {});
        } catch {}

        // Track funnel event
        try {
          const { trackFunnelEvent } = await import("./funnel-tracking");
          await trackFunnelEvent({
            clientId,
            leadId: opt.leadId,
            eventType: "job_won",
          });
        } catch {}
      } else if (action === "lost") {
        await db2
          .update(leads)
          .set({ status: "lost", updatedAt: new Date() })
          .where(and(eq(leads.id, opt.leadId), eq(leads.clientId, clientId)));
        lostLeads.push(opt.leadId);
        selectedLabels.push(`${opt.label} = Lost`);
      }
    }

    await db2
      .update(agencyMessages)
      .set({
        actionStatus: "executed",
        clientReply: parsed.selections
          .map(
            (s) =>
              `${s.action === "lost" ? "L" : "W"}${s.index}`,
          )
          .join(" "),
      })
      .where(eq(agencyMessages.id, pendingPrompt.id));

    // Build confirmation message
    const ack = selectedLabels.join(", ") + ". Updated.";
    await sendAgencySMS({
      clientId,
      toPhone: clientPhone,
      body: ack,
      category: "reply",
      inReplyTo: pendingPrompt.id,
    });

    // Send revenue prompt for first won lead (if any)
    if (wonLeads.length > 0) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      await db2.insert(agencyMessages).values({
        clientId,
        direction: "outbound",
        channel: "sms",
        content:
          wonLeads.length === 1
            ? "What was the job value? Reply with the amount (e.g. 55000) or S to skip."
            : `${wonLeads.length} wins recorded. What was the job value for the first one? Reply amount or S to skip.`,
        category: "action_prompt",
        promptType: "won_revenue_entry",
        actionPayload: { leadId: wonLeads[0] },
        actionStatus: "pending",
        expiresAt,
      });

      const agencyNumber = await getAgencyNumber();
      if (agencyNumber) {
        try {
          const twilioClient = (await import("twilio")).default(
            process.env.TWILIO_ACCOUNT_SID!,
            process.env.TWILIO_AUTH_TOKEN!,
          );
          await twilioClient.messages.create({
            to: clientPhone,
            from: agencyNumber,
            body:
              wonLeads.length === 1
                ? "What was the job value? Reply with the amount (e.g. 55000) or S to skip."
                : `${wonLeads.length} wins recorded. What was the job value for the first one? Reply amount or S to skip.`,
          });
        } catch {}
      }
    }

    return true;
  }

  // ── quote_prompt: "1" = start follow-up, "2" = skip ──
  if (interactionType === "quote_prompt") {
    const sel = parsed.selections[0];
    if (!sel) return false;

    const opt = options.find((o) => o.index === sel.index);
    if (!opt) return false;

    if (opt.action === "start_estimate" || sel.action === "select") {
      const result = await triggerEstimateFollowup({
        clientId,
        leadId: opt.leadId,
        source: "prompt_quick_reply",
      });

      await db2
        .update(agencyMessages)
        .set({ actionStatus: "executed", clientReply: String(sel.index) })
        .where(eq(agencyMessages.id, pendingPrompt.id));

      await sendAgencySMS({
        clientId,
        toPhone: clientPhone,
        body: result.success
          ? `Follow-up started for ${opt.label}.`
          : `Follow-up already running for ${opt.label}.`,
        category: "reply",
        inReplyTo: pendingPrompt.id,
      });
      return true;
    }

    if (opt.action === "skip") {
      await db2
        .update(agencyMessages)
        .set({ actionStatus: "replied", clientReply: String(sel.index) })
        .where(eq(agencyMessages.id, pendingPrompt.id));

      await sendAgencySMS({
        clientId,
        toPhone: clientPhone,
        body: "Got it, skipped.",
        category: "reply",
        inReplyTo: pendingPrompt.id,
      });
      return true;
    }
  }

  // ── est_disambiguation: bare digit selects lead ──
  if (interactionType === "est_disambiguation") {
    const sel = parsed.selections[0];
    if (!sel) return false;

    const opt = options.find((o) => o.index === sel.index);
    if (!opt) return false;

    const result = await triggerEstimateFollowup({
      clientId,
      leadId: opt.leadId,
      source: "sms_keyword",
    });

    await db2
      .update(agencyMessages)
      .set({ actionStatus: "executed", clientReply: String(sel.index) })
      .where(eq(agencyMessages.id, pendingPrompt.id));

    await sendAgencySMS({
      clientId,
      toPhone: clientPhone,
      body: result.success
        ? `Started estimate follow-up for ${opt.label}.`
        : `Follow-up already running for ${opt.label}.`,
      category: "reply",
      inReplyTo: pendingPrompt.id,
    });
    return true;
  }

  return false;
}

/**
 * Handle YES/NO reply (or synthetic "1"→YES, "2"→NO) for a pending prompt.
 * Extracted so numbered reply handler can delegate to it.
 */
async function handleAgencyYesNoReply(
  client: { id: string; phone: string; businessName: string },
  pendingPrompt: { id: string; promptType: string | null; actionPayload: unknown },
  inboundMsgId: string,
  reply: "YES" | "NO",
  rawBody: string,
): Promise<void> {
  const db2 = getDb();

  if (reply === "YES") {
    try {
      const actionResult = await executePromptAction(
        pendingPrompt.promptType!,
        pendingPrompt.actionPayload as Record<string, unknown>,
        client.id,
      );

      await db2
        .update(agencyMessages)
        .set({ actionStatus: "executed", clientReply: rawBody })
        .where(eq(agencyMessages.id, pendingPrompt.id));

      if (actionResult.ackMessage) {
        await sendAgencySMS({
          clientId: client.id,
          toPhone: client.phone,
          body: actionResult.ackMessage,
          category: "reply",
          inReplyTo: pendingPrompt.id,
        });
      }
    } catch (error) {
      console.error("[Agency Inbound] Failed to execute prompt action:", error);

      await db2
        .update(agencyMessages)
        .set({ actionStatus: "replied", clientReply: rawBody })
        .where(eq(agencyMessages.id, pendingPrompt.id));

      await sendAgencySMS({
        clientId: client.id,
        toPhone: client.phone,
        body: "Thanks — we received your approval, but this action needs manual handling by our team.",
        category: "reply",
        inReplyTo: pendingPrompt.id,
      });
      await notifyPromptFallback(
        client.id,
        client.businessName,
        rawBody,
        "execution_failure",
        error instanceof Error ? error.message : String(error),
      );
    }
    return;
  }

  // NO
  if (pendingPrompt.promptType === "won_lost_nudge") {
    const leadId =
      typeof (pendingPrompt.actionPayload as Record<string, unknown>)?.leadId === "string"
        ? ((pendingPrompt.actionPayload as Record<string, unknown>).leadId as string)
        : null;

    if (leadId) {
      await db2
        .update(leads)
        .set({ status: "lost", updatedAt: new Date() })
        .where(and(eq(leads.id, leadId), eq(leads.clientId, client.id)));
    }

    await db2
      .update(agencyMessages)
      .set({ actionStatus: "executed", clientReply: rawBody })
      .where(eq(agencyMessages.id, pendingPrompt.id));

    await sendAgencySMS({
      clientId: client.id,
      toPhone: client.phone,
      body: "Got it — lead marked as lost. Thanks for the update.",
      category: "reply",
      inReplyTo: pendingPrompt.id,
    });
    return;
  }

  await db2
    .update(agencyMessages)
    .set({ actionStatus: "replied", clientReply: rawBody })
    .where(eq(agencyMessages.id, pendingPrompt.id));

  await sendAgencySMS({
    clientId: client.id,
    toPhone: client.phone,
    body: "No problem — we'll skip this one.",
    category: "reply",
    inReplyTo: pendingPrompt.id,
  });
}

async function handleQuotePromptYes(
  actionPayload: Record<string, unknown>,
  clientId: string,
): Promise<PromptActionResult> {
  // Quote prompt YES = start estimate follow-up for the lead
  const options = Array.isArray(actionPayload.options) ? actionPayload.options : [];
  const firstOption = options[0] as { leadId?: string; label?: string } | undefined;
  const leadId = firstOption?.leadId ?? (actionPayload.leadId as string | undefined);

  if (!leadId) {
    throw new Error("quote_prompt: missing leadId in actionPayload");
  }

  const result = await triggerEstimateFollowup({
    clientId,
    leadId,
    source: "prompt_quick_reply",
  });

  const label = firstOption?.label ?? "this lead";
  return {
    ackMessage: result.success
      ? `Follow-up started for ${label}.`
      : `Follow-up already running for ${label}.`,
  };
}

const PROMPT_ACTION_HANDLERS: Record<string, PromptActionHandler> = {
  start_sequences: handleStartSequencesPrompt,
  schedule_callback: handleScheduleCallbackPrompt,
  confirm_action: handleConfirmActionPrompt,
  won_lost_nudge: handleWonLostNudgeYesPrompt,
  won_revenue_entry: handleWonRevenueEntryPrompt,
  quote_prompt: handleQuotePromptYes,
};

/** Dispatch prompt action based on promptType. */
async function executePromptAction(
  promptType: string,
  actionPayload: Record<string, unknown>,
  clientId: string,
): Promise<PromptActionResult> {
  console.log(`[Agency] Executing action: ${promptType}`, {
    clientId,
    actionPayload,
  });

  const handler = PROMPT_ACTION_HANDLERS[promptType];
  if (!handler) {
    throw new Error(`Unknown prompt type: ${promptType}`);
  }

  return handler(actionPayload, clientId);
}

async function notifyPromptFallback(
  clientId: string,
  businessName: string,
  clientReply: string,
  reason: "expired_or_missing_prompt" | "execution_failure",
  errorMessage?: string,
): Promise<void> {
  await sendEmail({
    to: process.env.ADMIN_EMAIL || "rmashrur749@gmail.com",
    subject: `Prompt fallback required — ${businessName}`,
    html: `
      <p>A client reply requires manual follow-up.</p>
      <p><strong>Business:</strong> ${businessName}</p>
      <p><strong>Client ID:</strong> ${clientId}</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p><strong>Reply:</strong> ${clientReply}</p>
      ${errorMessage ? `<p><strong>Error:</strong> ${errorMessage}</p>` : ""}
    `,
  });
}

// ---------------------------------------------------------------------------
// Cross-route: handle agency prompt replies that arrive on the business number
// ---------------------------------------------------------------------------

/**
 * Try to resolve a contractor's reply against a pending agency prompt.
 * Called from incoming-sms.ts when an authorized sender's message doesn't
 * match any business-channel command. This handles the case where the
 * contractor replies to a nudge/prompt on the wrong number.
 *
 * Returns true if the reply was handled, false to fall through.
 */
export async function tryResolveAgencyPromptCrossRoute(params: {
  clientId: string;
  clientPhone: string;
  clientBusinessName: string;
  replyBody: string;
}): Promise<boolean> {
  const { clientId, clientPhone, clientBusinessName, replyBody } = params;
  const body = replyBody.trim();
  const normalizedReply = body.toUpperCase();
  const db2 = getDb();

  // Find most recent pending prompt for this client
  const [pendingPrompt] = await db2
    .select()
    .from(agencyMessages)
    .where(
      and(
        eq(agencyMessages.clientId, clientId),
        eq(agencyMessages.actionStatus, "pending"),
        gte(agencyMessages.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(agencyMessages.createdAt))
    .limit(1);

  if (!pendingPrompt) return false;

  const client = { id: clientId, phone: clientPhone, businessName: clientBusinessName };

  // Check for numbered reply against prompt options
  const payloadOptions = extractPromptOptions(pendingPrompt.actionPayload);
  if (payloadOptions.length > 0 && isNumberedReply(body)) {
    const parsed = parseNumberedReply(body, payloadOptions.length);
    if (parsed.matched) {
      // Log cross-route for observability
      console.log(
        `[Agency CrossRoute] Handling numbered reply on business channel: client=${clientBusinessName}, reply=${body}`,
      );
      const handled = await executeNumberedReply(
        clientId,
        clientPhone,
        pendingPrompt,
        payloadOptions,
        parsed,
        pendingPrompt.id,
      );
      if (handled) return true;
    }
  }

  // Check for binary 1/2 as YES/NO on prompts without numbered options
  if (payloadOptions.length === 0 && (normalizedReply === "1" || normalizedReply === "2")) {
    const syntheticReply = normalizedReply === "1" ? "YES" : "NO";
    console.log(
      `[Agency CrossRoute] Handling ${syntheticReply} reply on business channel: client=${clientBusinessName}`,
    );
    await handleAgencyYesNoReply(client, pendingPrompt, pendingPrompt.id, syntheticReply, body);
    return true;
  }

  // Check for YES/Y/NO/N
  if (normalizedReply === "YES" || normalizedReply === "Y") {
    console.log(
      `[Agency CrossRoute] Handling YES reply on business channel: client=${clientBusinessName}`,
    );
    await handleAgencyYesNoReply(client, pendingPrompt, pendingPrompt.id, "YES", body);
    return true;
  }
  if (normalizedReply === "NO" || normalizedReply === "N") {
    console.log(
      `[Agency CrossRoute] Handling NO reply on business channel: client=${clientBusinessName}`,
    );
    await handleAgencyYesNoReply(client, pendingPrompt, pendingPrompt.id, "NO", body);
    return true;
  }

  // Check for revenue entry (numeric reply to won_revenue_entry prompt)
  if (
    pendingPrompt.promptType === "won_revenue_entry" &&
    /^\d[\d,.\s]*$/.test(body)
  ) {
    console.log(
      `[Agency CrossRoute] Handling revenue entry on business channel: client=${clientBusinessName}`,
    );
    const raw = body.replace(/[,\s]/g, "").replace(/\..*$/, "");
    const dollars = parseInt(raw, 10);
    const leadId =
      typeof (pendingPrompt.actionPayload as Record<string, unknown>)?.leadId === "string"
        ? ((pendingPrompt.actionPayload as Record<string, unknown>).leadId as string)
        : null;

    if (leadId && !isNaN(dollars) && dollars > 0) {
      await db2
        .update(leads)
        .set({ confirmedRevenue: dollars * 100, updatedAt: new Date() })
        .where(and(eq(leads.id, leadId), eq(leads.clientId, clientId)));

      await db2
        .update(agencyMessages)
        .set({ actionStatus: "executed", clientReply: body })
        .where(eq(agencyMessages.id, pendingPrompt.id));

      await sendAgencySMS({
        clientId,
        toPhone: clientPhone,
        body: `Logged. Job value set to $${dollars.toLocaleString()}. Thanks!`,
        category: "reply",
        inReplyTo: pendingPrompt.id,
      });
    } else {
      await sendAgencySMS({
        clientId,
        toPhone: clientPhone,
        body: "Could not read that amount. Please reply with a whole number (e.g. 55000).",
        category: "reply",
        inReplyTo: pendingPrompt.id,
      });
    }
    return true;
  }

  // Check for S/SKIP on revenue entry
  if (
    pendingPrompt.promptType === "won_revenue_entry" &&
    (normalizedReply === "S" || normalizedReply === "SKIP")
  ) {
    await db2
      .update(agencyMessages)
      .set({ actionStatus: "replied", clientReply: body })
      .where(eq(agencyMessages.id, pendingPrompt.id));

    await sendAgencySMS({
      clientId,
      toPhone: clientPhone,
      body: "Skipped. Using your average job value for reporting.",
      category: "reply",
      inReplyTo: pendingPrompt.id,
    });
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Weekly Digest
// ---------------------------------------------------------------------------

/** Send a weekly digest SMS + email for a single client. */
export async function sendWeeklyDigest(clientId: string): Promise<void> {
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) return;

  // Get stats for last 7 days
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const weekStr = weekAgo.toISOString().split("T")[0];
  const twoWeeksStr = twoWeeksAgo.toISOString().split("T")[0];
  const nowStr = now.toISOString().split("T")[0];

  // Current week stats
  const currentWeekStats = await db
    .select({
      totalLeads: sql<number>`coalesce(sum(${dailyStats.missedCallsCaptured}) + sum(${dailyStats.formsResponded}), 0)`,
      totalMessages: sql<number>`coalesce(sum(${dailyStats.messagesSent}), 0)`,
      totalAppointments: sql<number>`coalesce(sum(${dailyStats.appointmentsReminded}), 0)`,
      missedCalls: sql<number>`coalesce(sum(${dailyStats.missedCallsCaptured}), 0)`,
      formsResponded: sql<number>`coalesce(sum(${dailyStats.formsResponded}), 0)`,
      estimatesFollowed: sql<number>`coalesce(sum(${dailyStats.estimatesFollowedUp}), 0)`,
      reviewsRequested: sql<number>`coalesce(sum(${dailyStats.reviewsRequested}), 0)`,
    })
    .from(dailyStats)
    .where(
      and(
        eq(dailyStats.clientId, clientId),
        gte(dailyStats.date, weekStr),
        lte(dailyStats.date, nowStr),
      ),
    );

  // Previous week stats for trend
  const prevWeekStats = await db
    .select({
      totalLeads: sql<number>`coalesce(sum(${dailyStats.missedCallsCaptured}) + sum(${dailyStats.formsResponded}), 0)`,
      totalMessages: sql<number>`coalesce(sum(${dailyStats.messagesSent}), 0)`,
    })
    .from(dailyStats)
    .where(
      and(
        eq(dailyStats.clientId, clientId),
        gte(dailyStats.date, twoWeeksStr),
        lt(dailyStats.date, weekStr),
      ),
    );

  const current = currentWeekStats[0];
  const previous = prevWeekStats[0];

  const totalLeads = Number(current?.totalLeads ?? 0);
  const totalMessages = Number(current?.totalMessages ?? 0);
  const totalAppointments = Number(current?.totalAppointments ?? 0);
  const prevLeads = Number(previous?.totalLeads ?? 0);

  // Trend calculation
  let trendText = "";
  if (prevLeads > 0) {
    const change = Math.round(((totalLeads - prevLeads) / prevLeads) * 100);
    trendText =
      change >= 0
        ? ` (${change}% up from last week)`
        : ` (${Math.abs(change)}% down from last week)`;
  }

  const conversionRate =
    totalMessages > 0
      ? ((totalAppointments / totalMessages) * 100).toFixed(1)
      : "0.0";

  // Build SMS
  const smsBody = [
    `Weekly Digest for ${client.businessName}:`,
    ``,
    `Leads: ${totalLeads}${trendText}`,
    `Messages sent: ${totalMessages}`,
    `Appointments: ${totalAppointments}`,
    `Conversion rate: ${conversionRate}%`,
  ].join("\n");

  // Check if there are action items (leads without sequences)
  const hasActionItems = totalLeads > 0 && totalAppointments === 0;
  const fullSmsBody = hasActionItems
    ? `${smsBody}\n\nYou have leads without follow-ups. Reply YES to start automated sequences.`
    : smsBody;

  // Send SMS digest
  if (client.phone) {
    if (hasActionItems) {
      await sendActionPrompt({
        clientId: client.id,
        promptType: "start_sequences",
        message: fullSmsBody,
        actionPayload: { source: "weekly_digest" },
        expiresInHours: 48,
      });
    } else {
      await sendAgencySMS({
        clientId: client.id,
        toPhone: client.phone,
        body: fullSmsBody,
        category: "weekly_digest",
      });
    }
  }

  // Send email digest
  if (client.email) {
    const weekStartFormatted = weekAgo.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const weekEndFormatted = now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    const emailData = agencyWeeklyDigestEmail({
      ownerName: client.ownerName,
      businessName: client.businessName,
      weekStart: weekStartFormatted,
      weekEnd: weekEndFormatted,
      stats: {
        totalLeads,
        totalMessages,
        totalAppointments,
        conversionRate,
        missedCalls: Number(current?.missedCalls ?? 0),
        formsResponded: Number(current?.formsResponded ?? 0),
        estimatesFollowed: Number(current?.estimatesFollowed ?? 0),
        reviewsRequested: Number(current?.reviewsRequested ?? 0),
      },
      trend: trendText,
      hasActionItems,
      dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.conversionsurgery.com"}/dashboard`,
    });

    const result = await sendEmail({
      to: client.email,
      subject: emailData.subject,
      html: emailData.html,
    });

    await db
      .insert(agencyMessages)
      .values({
        clientId: client.id,
        direction: "outbound",
        channel: "email",
        content: emailData.html,
        subject: emailData.subject,
        category: "weekly_digest",
        delivered: result.success,
      })
      .catch(() => {});
  }

  console.log(`[Agency] Weekly digest sent for: ${client.businessName}`);
}

/** Loop over all active clients and send digest to each. */
export async function processAgencyWeeklyDigests(): Promise<number> {
  const db = getDb();
  const activeClients = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.status, "active"));

  let sent = 0;
  for (const client of activeClients) {
    try {
      await sendWeeklyDigest(client.id);
      sent++;
    } catch (error) {
      console.error(`[Agency] Failed digest for client ${client.id}:`, error);
    }
  }

  console.log(`[Agency] Weekly digests sent: ${sent}/${activeClients.length}`);
  return sent;
}

// ---------------------------------------------------------------------------
// Expire prompts
// ---------------------------------------------------------------------------

/** Mark expired prompts as 'expired'. Called by cron. */
export async function expirePendingPrompts(): Promise<number> {
  const db = getDb();
  const result = await db
    .update(agencyMessages)
    .set({ actionStatus: "expired" })
    .where(
      and(
        eq(agencyMessages.actionStatus, "pending"),
        lt(agencyMessages.expiresAt, new Date()),
      ),
    )
    .returning({ id: agencyMessages.id });

  if (result.length > 0) {
    console.log(`[Agency] Expired ${result.length} pending prompts`);
  }
  return result.length;
}
