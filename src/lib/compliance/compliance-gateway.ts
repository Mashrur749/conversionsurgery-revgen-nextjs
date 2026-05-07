import { _sendSmsToTwilio } from '@/lib/services/twilio';
import { ComplianceService } from './compliance-service';
import { getClientUsagePolicy, getSubscriptionWithPlan } from '@/lib/services/subscription';
import { getDb, clients, leads, consentRecords, quietHoursConfig, scheduledMessages, blockedNumbers, optOutRecords, doNotContactList } from '@/db';
import { isMessageLimitReached } from '@/lib/services/usage-policy';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { getTimezoneOffset } from 'date-fns-tz';
import { createHash } from 'crypto';
import {
  getQuietHoursPolicy,
  resolveQuietHoursDecision,
  type QuietHoursPolicyMode,
  type QuietHoursMessageClassification,
} from '@/lib/compliance/quiet-hours-policy';
import { isOpsKillSwitchEnabled, OPS_KILL_SWITCH_KEYS } from '@/lib/services/ops-kill-switches';
import { resolveFeatureFlag } from '@/lib/services/feature-flags';
import { QUIET_HOURS_MESSAGE_CLASSIFICATIONS } from '@/lib/compliance/quiet-hours-policy';

/**
 * Infer IANA timezone from North American phone number area code.
 * Covers major Canadian and US area codes for CASL/TCPA compliance.
 */
function inferTimezoneFromPhone(phoneNumber: string): string | undefined {
  const digits = phoneNumber.replace(/\D/g, '');
  // Extract area code (skip +1 prefix if present)
  const areaCode = digits.length === 10 ? digits.slice(0, 3) : digits.length === 11 && digits.startsWith('1') ? digits.slice(1, 4) : undefined;
  if (!areaCode) return undefined;

  const areaCodeNum = parseInt(areaCode, 10);

  // Pacific (UTC-8/-7)
  if (
    [204, 250, 604, 778, 236, 672].includes(areaCodeNum) || // BC, MB
    [206, 253, 360, 425, 509, 541, 503, 971].includes(areaCodeNum) // WA, OR
  ) {
    return 'America/Vancouver';
  }

  // Mountain (UTC-7/-6)
  if (
    [403, 587, 780, 825].includes(areaCodeNum) || // AB
    [208, 406, 307, 435, 505, 575, 702, 725, 775].includes(areaCodeNum) // ID, MT, WY, UT, NV
  ) {
    return 'America/Edmonton';
  }

  // Central (UTC-6/-5)
  if (
    [204, 431, 506].includes(areaCodeNum) || // MB, NB
    [204, 431].includes(areaCodeNum) || // MB
    [204, 431, 306, 639].includes(areaCodeNum) || // MB, SK
    [204, 431, 306, 639, 807].includes(areaCodeNum) || // MB, SK, ON (NW)
    [204, 431, 306, 639, 807, 416, 647, 437, 905, 289, 365, 742, 519, 226, 548, 613, 343, 705, 249, 226].includes(areaCodeNum) // ON
  ) {
    return 'America/Winnipeg';
  }

  // Eastern (UTC-5/-4)
  if (
    [416, 647, 437, 905, 289, 365, 742, 519, 226, 548, 613, 343, 753, 705, 249, 226, 807].includes(areaCodeNum) || // ON
    [514, 438, 450, 579, 819, 873, 354].includes(areaCodeNum) || // QC
    [902, 782, 506, 428].includes(areaCodeNum) // NS, NB, PEI
  ) {
    return 'America/Toronto';
  }

  // Atlantic (UTC-4/-3)
  if (
    [709, 867].includes(areaCodeNum) // NL, NT/NU/YT
  ) {
    return 'America/Halifax';
  }

  // US Eastern
  if (
    [212, 315, 347, 516, 518, 585, 607, 631, 646, 716, 718, 845, 914, 917, 929].includes(areaCodeNum) || // NY
    [201, 609, 640, 732, 848, 856, 862, 908, 973].includes(areaCodeNum) // NJ
  ) {
    return 'America/New_York';
  }

  // US Central
  if (
    [214, 281, 512, 713, 832, 903, 915, 936, 940, 956, 972, 254, 325, 361, 409, 430, 432, 469, 682, 737, 806, 817, 830, 903, 936, 940, 956, 972].includes(areaCodeNum) // TX
  ) {
    return 'America/Chicago';
  }

  return undefined;
}

/**
 * Consent basis for first-contact messages.
 * Under CASL, an inbound call or form submission constitutes an "inquiry"
 * which grants implied consent for 6 months (s.10(9)(b)).
 */
export type ConsentBasis =
  | { type: 'missed_call'; callSid: string }
  | { type: 'form_submission'; formSubmissionId?: string }
  | { type: 'lead_reply'; messageId?: string }
  | { type: 'existing_customer'; transactionDate?: Date }
  | { type: 'existing_consent' }; // Consent already recorded

export type MessageCategory = 'marketing' | 'transactional';

export interface SendCompliantMessageParams {
  clientId: string;
  to: string;
  from: string;
  body: string;
  messageClassification: QuietHoursMessageClassification;
  messageCategory?: MessageCategory;
  consentBasis?: ConsentBasis;
  leadId?: string;
  /**
   * The recipient's (homeowner's) local timezone (IANA format, e.g. "America/New_York").
   * TCPA/CASL quiet hours must be evaluated against the CALLED PARTY's local time, not the
   * client's (contractor's) timezone. Pass this whenever you have lead location data.
   * Falls back to the client's timezone when omitted.
     */
  recipientTimezone?: string;
  /** If true, queue for next available window instead of failing on quiet hours */
  queueOnQuietHours?: boolean;
  /**
   * The intended wall-clock time for this send (e.g. when the automation was triggered).
   * When provided, quiet hours are evaluated against this time instead of `new Date()`.
   * This prevents a message queued at 8:59pm from being re-queued if it is processed
   * a few minutes later at 9:01pm.
   */
  intendedSendAt?: Date;
  /** Optional media URLs for MMS */
  mediaUrl?: string[];
  /** Optional metadata for audit logging */
  metadata?: Record<string, unknown>;
}

export interface SendCompliantMessageResult {
  sent: boolean;
  queued: boolean;
  blocked: boolean;
  messageSid?: string;
  blockReason?: string;
  consentId?: string;
  warnings: string[];
  auditId?: string;
}

/**
 * The single gateway for ALL outbound SMS in ConversionSurgery.
 *
 * Every automation, AI response, flow step, scheduled message, and manual send
 * MUST go through this function. It ensures:
 *
 * 1. Opt-out check (STOP/unsubscribe honored)
 * 2. DNC check (internal + DNCL)
 * 3. Consent validation (auto-records implied consent for first-contact)
 * 4. CASL consent expiry enforcement (6mo inquiry / 2yr customer)
 * 5. Quiet hours enforcement (9pm-10am, CRTC-compliant)
 * 6. Monthly message limit check
 * 7. Audit logging for every attempt (pass or fail)
 */
export async function sendCompliantMessage(
  params: SendCompliantMessageParams
): Promise<SendCompliantMessageResult> {
  const {
    clientId,
    to,
    from,
    body,
    messageClassification,
    messageCategory = 'marketing',
    consentBasis,
    leadId,
    recipientTimezone,
    queueOnQuietHours = true,
    intendedSendAt,
    mediaUrl,
    metadata,
  } = params;

  const warnings: string[] = [];
  const normalizedPhone = ComplianceService.normalizePhoneNumber(to);
  const phoneHash = ComplianceService.hashPhoneNumber(normalizedPhone);

  // Per-client pause: block outbound if client status is paused or cancelled
  const clientDb = getDb();
  const [clientRow] = await clientDb
    .select({ status: clients.status })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (clientRow && (clientRow.status === 'paused' || clientRow.status === 'cancelled')) {
    return blocked(
      `Client automations paused (status: ${clientRow.status})`,
      normalizedPhone,
      phoneHash,
      clientId,
      {
        messageCategory,
        messageClassification,
        leadId,
        clientStatus: clientRow.status,
        ...metadata,
      }
    );
  }

  // Subscription enforcement: block proactive outreach when subscription is past_due (XDOM-02)
  // Allow inbound replies so homeowners don't get ghosted during billing issues.
  const subResult = await getSubscriptionWithPlan(clientId);
  if (subResult && subResult.subscription.status === 'past_due') {
    if (messageClassification !== 'inbound_reply') {
      return blocked(
        `Subscription past_due — blocking ${messageClassification} (only inbound replies allowed)`,
        normalizedPhone,
        phoneHash,
        clientId,
        {
          messageCategory,
          messageClassification,
          leadId,
          subscriptionStatus: 'past_due',
          ...metadata,
        }
      );
    }
    // past_due + inbound_reply: allow through with warning
    warnings.push('Subscription past_due — allowing inbound reply only');
  }

  // Platform-wide kill switch
  const outboundKillSwitchEnabled = await isOpsKillSwitchEnabled(
    OPS_KILL_SWITCH_KEYS.OUTBOUND_AUTOMATIONS
  );
  if (outboundKillSwitchEnabled) {
    return blocked(
      'Outbound automations paused by operator kill switch',
      normalizedPhone,
      phoneHash,
      clientId,
      {
        messageCategory,
        messageClassification,
        leadId,
        killSwitch: OPS_KILL_SWITCH_KEYS.OUTBOUND_AUTOMATIONS,
        ...metadata,
      }
    );
  }

  // -----------------------------------------------------------
  // Step 0 (pre): Platform-level DNC — if this number opted out from
  // ANY client on the platform, block the send for all clients.
  // This prevents a homeowner from being re-contacted after opting out
  // with a different contractor on the same platform.
  // -----------------------------------------------------------
  const dncDb = getDb();
  const [platformDncRecord] = await dncDb
    .select({ id: blockedNumbers.id, reason: blockedNumbers.reason })
    .from(blockedNumbers)
    .where(eq(blockedNumbers.phone, normalizedPhone))
    .limit(1);

  if (platformDncRecord) {
    return blocked(
      'Platform-level DNC — number opted out from another client',
      normalizedPhone,
      phoneHash,
      clientId,
      {
        messageCategory,
        messageClassification,
        leadId,
        platformDncReason: platformDncRecord.reason,
        ...metadata,
      }
    );
  }

  // -----------------------------------------------------------
  // Step 0: Check monthly message limit BEFORE expensive checks
  // -----------------------------------------------------------
  const db = getDb();
  const [clientData] = await db
    .select({
      messagesSentThisMonth: clients.messagesSentThisMonth,
      monthlyMessageLimit: clients.monthlyMessageLimit,
      timezone: clients.timezone,
      isTest: clients.isTest,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!clientData) {
    return blocked('Client not found', normalizedPhone, phoneHash, clientId, metadata);
  }

  // Test clients: skip actual SMS, return simulated success
  if (clientData.isTest) {
    console.log(`[Compliance] Test client ${clientId} — SMS simulated to ${normalizedPhone}`);
    return {
      sent: true,
      queued: false,
      blocked: false,
      messageSid: `TEST_${Date.now()}`,
      consentId: undefined,
      warnings: ['Test mode — no SMS sent'],
    };
  }

  const usagePolicy = await getClientUsagePolicy(clientId);
  const limitCheck = isMessageLimitReached(
    clientData.messagesSentThisMonth,
    usagePolicy,
    clientData.monthlyMessageLimit
  );

  if (limitCheck.reached) {
    return blocked(
      `Monthly message limit reached (${limitCheck.limit})`,
      normalizedPhone,
      phoneHash,
      clientId,
      metadata
    );
  }

  // -----------------------------------------------------------
  // Step 0.5: Resolve quiet-hours policy and delivery decision
  // -----------------------------------------------------------
  // TCPA/CASL: quiet hours must be evaluated in the RECIPIENT's (called party's) local time.
  // Prefer the explicitly-provided recipientTimezone; fall back to area-code inference,
  // then the client's timezone when recipient location is unknown.
  const effectiveTimezone =
    recipientTimezone ||
    inferTimezoneFromPhone(normalizedPhone) ||
    clientData.timezone ||
    undefined;
  const quietHoursResult = await ComplianceService.isQuietHours(
    clientId,
    effectiveTimezone,
    intendedSendAt
  );
  const quietHoursPolicy = await getQuietHoursPolicy(clientId, { trackModeChanges: true });

  // FMA 6.4: When inboundReplyExemptionEnabled is off for this client, treat
  // inbound_reply messages as proactive_outreach so quiet-hours enforcement
  // applies identically to all outbound. This preserves the default (strict)
  // behavior and lets operators opt specific clients into the exemption.
  let effectiveClassification = messageClassification;
  if (messageClassification === QUIET_HOURS_MESSAGE_CLASSIFICATIONS.INBOUND_REPLY) {
    const exemptionEnabled = await resolveFeatureFlag(clientId, 'inboundReplyExemptionEnabled');
    if (!exemptionEnabled) {
      effectiveClassification = QUIET_HOURS_MESSAGE_CLASSIFICATIONS.PROACTIVE_OUTREACH;
    }
  }

  const quietHoursDecision = resolveQuietHoursDecision({
    isQuietHours: quietHoursResult.isQuietHours,
    queueOnQuietHours,
    policyMode: quietHoursPolicy.mode,
    messageClassification: effectiveClassification,
  });
  const quietHoursAuditMetadata = buildQuietHoursDecisionAuditMetadata({
    policyMode: quietHoursPolicy.mode,
    messageClassification: effectiveClassification,
    decision: quietHoursDecision.decision,
    quietHoursReason: quietHoursResult.reason,
  });

  if (quietHoursDecision.decision === 'block' && quietHoursDecision.reason === 'Missing quiet-hours message classification') {
    return blocked(
      quietHoursDecision.reason,
      normalizedPhone,
      phoneHash,
      clientId,
      {
        ...metadata,
        ...quietHoursAuditMetadata,
      }
    );
  }

  // -----------------------------------------------------------
  // Step 1: Auto-record implied consent if this is first contact
  // -----------------------------------------------------------
  if (consentBasis && consentBasis.type !== 'existing_consent') {
    await ensureConsentRecorded(clientId, normalizedPhone, consentBasis, leadId);
  }

  // -----------------------------------------------------------
  // Step 2: Run full compliance check (opt-out, DNC, consent, quiet hours)
  // -----------------------------------------------------------
  const complianceResult = await ComplianceService.checkCompliance(
    clientId,
    normalizedPhone,
    messageCategory,
    effectiveTimezone,
    {
      skipQuietHoursCheck:
        quietHoursResult.isQuietHours && quietHoursDecision.decision === 'send',
    }
  );

  // -----------------------------------------------------------
  // Step 3: Handle blocked scenarios
  // -----------------------------------------------------------
  if (complianceResult.isOptedOut) {
    return blocked('Recipient has opted out', normalizedPhone, phoneHash, clientId, {
      ...quietHoursAuditMetadata,
      ...metadata,
    });
  }

  if (complianceResult.isOnDnc) {
    return blocked(
      complianceResult.blockReason || 'Number on Do Not Contact list',
      normalizedPhone,
      phoneHash,
      clientId,
      {
        ...quietHoursAuditMetadata,
        ...metadata,
      }
    );
  }

  if (!complianceResult.hasConsent) {
    // If we just recorded consent above but cache is stale, try one more time
    // by clearing cache and re-checking
    if (consentBasis && consentBasis.type !== 'existing_consent') {
      // We just recorded consent — this might be a cache issue. Log warning and proceed.
      warnings.push('Consent was just recorded but compliance check returned no consent — proceeding with caution');
    } else {
      return blocked(
        complianceResult.blockReason || 'No valid consent record',
        normalizedPhone,
        phoneHash,
        clientId,
        {
          ...quietHoursAuditMetadata,
          ...metadata,
        }
      );
    }
  }

  // -----------------------------------------------------------
  // Step 4: Handle quiet hours
  // -----------------------------------------------------------
  if (quietHoursResult.isQuietHours) {
    if (quietHoursDecision.decision === 'queue') {
      let queuedSendAt: Date | null = null;
      if (leadId) {
        // Fall back to Pacific (most restrictive NA timezone) when client timezone is unset
        queuedSendAt = await getNextAllowedSendAt(clientId, clientData.timezone || 'America/Los_Angeles');

        // Duplicate guard: if a quiet_hours_queue entry already exists for this
        // lead with the same content (same hash), skip insertion. This prevents
        // the edge-case where intendedSendAt was just before quiet hours but
        // processing crosses the boundary, causing a double-queue.
        const contentHash = createHash('sha256').update(body).digest('hex');
        const [existingQueueEntry] = await db
          .select({ id: scheduledMessages.id })
          .from(scheduledMessages)
          .where(
            and(
              eq(scheduledMessages.leadId, leadId),
              eq(scheduledMessages.sequenceType, 'quiet_hours_queue'),
              eq(scheduledMessages.content, body),
              eq(scheduledMessages.sent, false),
              eq(scheduledMessages.cancelled, false)
            )
          )
          .limit(1);

        if (!existingQueueEntry) {
          await db.insert(scheduledMessages).values({
            clientId,
            leadId,
            sequenceType: 'quiet_hours_queue',
            content: body,
            sendAt: queuedSendAt,
          });
        } else {
          // Already queued — log but don't insert a duplicate
          await ComplianceService.logComplianceEvent(clientId, 'message_queue_duplicate_skipped', {
            phoneNumber: normalizedPhone,
            phoneHash,
            leadId,
            contentHash,
            existingQueueId: existingQueueEntry.id,
            reason: 'quiet_hours_queue entry already exists for this lead+content',
          });
        }
      }

      await ComplianceService.logComplianceEvent(clientId, 'message_queued', {
        phoneNumber: normalizedPhone,
        phoneHash,
        from,
        body,
        mediaUrl,
        reason: 'quiet_hours',
        messageCategory,
        messageClassification,
        leadId,
        queuedSendAt: queuedSendAt?.toISOString(),
        persistedToSchedule: !!queuedSendAt,
        ...quietHoursAuditMetadata,
        ...metadata,
      });

      return {
        sent: false,
        queued: true,
        blocked: false,
        blockReason: quietHoursResult.reason,
        consentId: complianceResult.consentId,
        warnings: [...warnings, 'Message queued for next available window (quiet hours)'],
      };
    }

    if (quietHoursDecision.decision === 'block') {
      return blocked(
        quietHoursDecision.reason || quietHoursResult.reason || 'Quiet hours — cannot send',
        normalizedPhone,
        phoneHash,
        clientId,
        {
          ...metadata,
          ...quietHoursAuditMetadata,
        }
      );
    }

    await ComplianceService.logComplianceEvent(clientId, 'message_quiet_hours_allowed', {
      phoneNumber: normalizedPhone,
      phoneHash,
      from,
      body,
      mediaUrl,
      reason: quietHoursResult.reason,
      messageCategory,
      messageClassification,
      leadId,
      ...quietHoursAuditMetadata,
      ...metadata,
    });
    warnings.push('Quiet-hours send allowed by active inbound-reply policy mode');
  }

  // -----------------------------------------------------------
  // Step 5: Check consent-specific can-send for message category
  // -----------------------------------------------------------
  if (!complianceResult.canSend) {
    return blocked(
      complianceResult.blockReason || `Cannot send ${messageCategory} messages — insufficient consent scope`,
      normalizedPhone,
      phoneHash,
      clientId,
      {
        ...quietHoursAuditMetadata,
        ...metadata,
      }
    );
  }

  // Collect compliance warnings
  warnings.push(...complianceResult.warnings);

  // -----------------------------------------------------------
  // Step 6: Send the message
  // -----------------------------------------------------------
  let messageSid: string;
  try {
    messageSid = await _sendSmsToTwilio(normalizedPhone, body, from, mediaUrl?.length ? { mediaUrl } : undefined);
  } catch (error) {
    // Log failed send attempt
    await ComplianceService.logComplianceEvent(clientId, 'message_send_failed', {
      phoneNumber: normalizedPhone,
      phoneHash,
      messageCategory,
      messageClassification,
      quietHoursPolicyMode: quietHoursPolicy.mode,
      error: error instanceof Error ? error.message : String(error),
      consentId: complianceResult.consentId,
      ...metadata,
    });

    throw error;
  }

  // -----------------------------------------------------------
  // Step 7: Log successful send + increment monthly count
  // -----------------------------------------------------------
  await ComplianceService.logComplianceEvent(clientId, 'message_sent', {
    phoneNumber: normalizedPhone,
    phoneHash,
    messageSid,
    messageCategory,
    messageClassification,
    quietHoursPolicyMode: quietHoursPolicy.mode,
    consentId: complianceResult.consentId,
    leadId,
    ...metadata,
  });

  // Increment monthly message count
  await db
    .update(clients)
    .set({
      messagesSentThisMonth: sql`${clients.messagesSentThisMonth} + 1`,
    })
    .where(eq(clients.id, clientId));

  return {
    sent: true,
    queued: false,
    blocked: false,
    messageSid,
    consentId: complianceResult.consentId,
    warnings,
  };
}

/**
 * Auto-record implied consent for first-contact scenarios.
 * Under CASL, inbound calls and form submissions constitute inquiries
 * granting implied consent for 6 months.
 */
async function ensureConsentRecorded(
  clientId: string,
  phoneNumber: string,
  basis: ConsentBasis,
  leadId?: string
): Promise<void> {
  const db = getDb();
  const phoneHash = ComplianceService.hashPhoneNumber(phoneNumber);

  // Check if active consent already exists
  const existing = await db.query.consentRecords.findFirst({
    where: and(
      eq(consentRecords.clientId, clientId),
      eq(consentRecords.phoneNumberHash, phoneHash),
      eq(consentRecords.isActive, true)
    ),
  });

  if (existing) {
    // Consent already recorded — if lead replied, upgrade to express
    if (basis.type === 'lead_reply' && existing.consentType === 'implied') {
      await db
        .update(consentRecords)
        .set({
          consentType: 'express_written',
          consentSource: 'text_optin',
          consentLanguage:
            'Lead replied to automated message, constituting express consent under CASL.',
          updatedAt: new Date(),
        })
        .where(eq(consentRecords.id, existing.id));
    }
    return;
  }

  // Determine consent parameters based on basis
  let consentSource: 'phone_recording' | 'web_form' | 'text_optin' | 'existing_customer';
  let consentLanguage: string;
  let evidence: Record<string, unknown> = {};

  switch (basis.type) {
    case 'missed_call':
      consentSource = 'phone_recording';
      consentLanguage =
        'Implied consent from inbound call (inquiry) under CASL s.10(9)(b). Valid for 6 months.';
      evidence = { callSid: basis.callSid };
      break;
    case 'form_submission':
      consentSource = 'web_form';
      consentLanguage =
        'Implied consent from form submission (inquiry) under CASL s.10(9)(b). Valid for 6 months.';
      evidence = { formSubmissionId: basis.formSubmissionId };
      break;
    case 'lead_reply':
      consentSource = 'text_optin';
      consentLanguage =
        'Express consent from SMS reply. Lead initiated further conversation.';
      evidence = { messageId: basis.messageId };
      break;
    case 'existing_customer':
      consentSource = 'existing_customer';
      consentLanguage =
        'Implied consent from existing business relationship under CASL s.10(9)(a). Valid for 2 years from last transaction.';
      evidence = { transactionDate: basis.transactionDate };
      break;
    default:
      return;
  }

  await ComplianceService.recordConsent(clientId, phoneNumber, {
    type:
      basis.type === 'lead_reply' ? 'express_written' : 'implied',
    source: consentSource,
    scope: {
      marketing: true,
      transactional: true,
      promotional: false,
      reminders: true,
    },
    language: consentLanguage,
    ...(evidence.callSid ? { recordingUrl: `twilio:call:${evidence.callSid}` } : {}),
    ...(evidence.formSubmissionId
      ? { formUrl: `form:submission:${evidence.formSubmissionId}` }
      : {}),
  });
}

/**
 * Helper to create a blocked result with consistent audit logging
 */
async function blocked(
  reason: string,
  phoneNumber: string,
  phoneHash: string,
  clientId: string,
  metadata?: Record<string, unknown>
): Promise<SendCompliantMessageResult> {
  await ComplianceService.logComplianceEvent(clientId, 'message_blocked', {
    phoneNumber,
    phoneHash,
    reason,
    ...metadata,
  });

  return {
    sent: false,
    queued: false,
    blocked: true,
    blockReason: reason,
    warnings: [],
  };
}

function buildQuietHoursDecisionAuditMetadata(input: {
  policyMode: QuietHoursPolicyMode;
  messageClassification?: QuietHoursMessageClassification | null;
  decision: 'send' | 'queue' | 'block';
  quietHoursReason?: string;
}): Record<string, unknown> {
  return {
    quietHoursPolicyMode: input.policyMode,
    messageClassification: input.messageClassification ?? 'unclassified',
    quietHoursDecision: input.decision,
    quietHoursReason: input.quietHoursReason,
  };
}

async function getNextAllowedSendAt(clientId: string, timezone: string): Promise<Date> {
  const db = getDb();
  const now = new Date();
  const offset = getTimezoneOffset(timezone, now);
  const localNow = new Date(now.getTime() + offset);
  const localDay = localNow.getUTCDay();
  const isWeekend = localDay === 0 || localDay === 6;

  const config = await db.query.quietHoursConfig.findFirst({
    where: eq(quietHoursConfig.clientId, clientId),
  });

  const quietStart = isWeekend && config?.weekendQuietStartHour !== null && config?.weekendQuietStartHour !== undefined
    ? config.weekendQuietStartHour
    : (config?.quietStartHour ?? 21);

  const quietEnd = isWeekend && config?.weekendQuietEndHour !== null && config?.weekendQuietEndHour !== undefined
    ? config.weekendQuietEndHour
    : (config?.quietEndHour ?? 10);

  const localHour = localNow.getUTCHours();
  const localTarget = new Date(localNow);
  localTarget.setUTCMinutes(1, 0, 0);

  if (quietStart > quietEnd) {
    if (localHour >= quietStart) {
      localTarget.setUTCDate(localTarget.getUTCDate() + 1);
    }
    localTarget.setUTCHours(quietEnd);
  } else {
    localTarget.setUTCHours(quietEnd);
    if (localHour >= quietEnd) {
      localTarget.setUTCDate(localTarget.getUTCDate() + 1);
    }
  }

  // Convert the computed local target back to UTC-ish timestamp using current zone offset.
  return new Date(localTarget.getTime() - offset);
}

// ===========================================================================
// Internal SMS gateway — operator alerts only
// ===========================================================================

/**
 * Parameters for sendInternalSMS.
 */
export interface SendInternalSMSParams {
  /** Operator's personal phone (E.164 or normalizable). */
  to: string;
  /** Sender phone (agency Twilio number). */
  from: string;
  /** Message body. */
  body: string;
  /** Subject identifier — used for audit logging and dedup keys upstream. */
  subject: string;
  /** Optional structured metadata for the audit log. */
  metadata?: Record<string, unknown>;
}

/**
 * Result returned by sendInternalSMS.
 */
export interface SendInternalSMSResult {
  sent: boolean;
  blocked: boolean;
  blockReason?: string;
  messageSid?: string;
  auditId?: string;
}

/**
 * FOR OPERATOR-FACING / INTERNAL ALERTS ONLY.
 *
 * Adding callers other than operator-alert paths requires explicit security review.
 * For lead-facing or contractor-facing sends, use {@link sendCompliantMessage} instead —
 * that path enforces the full CASL/TCPA pipeline (consent, quiet hours, monthly limits).
 *
 * This path is the narrow gateway for alerts the operator MUST receive (system errors,
 * compliance incidents, etc.). It still runs three sentinel checks before transport:
 *   1. Operator kill switch (OUTBOUND_AUTOMATIONS).
 *   2. Recipient opt-out — should never be true for operator phone, but if a
 *      misconfiguration puts the operator on opt-out we surface it loudly.
 *   3. Platform DNC.
 *
 * Every call writes to compliance_audit_log with category
 *   - `internal_sms_sent` on success
 *   - `internal_sms_sentinel_block` on block
 * so Phase 2 sentinel-counter dashboards can derive metrics.
 */
export async function sendInternalSMS(
  params: SendInternalSMSParams
): Promise<SendInternalSMSResult> {
  const { to, from, body, subject, metadata } = params;

  const normalizedPhone = ComplianceService.normalizePhoneNumber(to);
  const phoneHash = ComplianceService.hashPhoneNumber(normalizedPhone);

  const baseAuditMetadata: Record<string, unknown> = {
    phoneNumber: normalizedPhone,
    phoneHash,
    subject,
    direction: 'internal_operator_alert',
    ...metadata,
  };

  // -----------------------------------------------------------
  // Sentinel 1: kill switch
  // -----------------------------------------------------------
  const killSwitchOn = await isOpsKillSwitchEnabled(
    OPS_KILL_SWITCH_KEYS.OUTBOUND_AUTOMATIONS
  );
  if (killSwitchOn) {
    await ComplianceService.logComplianceEvent(null, 'internal_sms_sentinel_block', {
      ...baseAuditMetadata,
      blockReason: 'kill_switch',
    });
    return {
      sent: false,
      blocked: true,
      blockReason: 'kill_switch',
    };
  }

  // -----------------------------------------------------------
  // Sentinel 2: opt-out (operator phone should never be opted out;
  // if it is, that's a misconfiguration we MUST surface)
  // -----------------------------------------------------------
  const db = getDb();
  const optOut = await db.query.optOutRecords.findFirst({
    where: and(
      eq(optOutRecords.phoneNumberHash, phoneHash),
      isNull(optOutRecords.reoptedInAt)
    ),
  });
  if (optOut) {
    await ComplianceService.logComplianceEvent(null, 'internal_sms_sentinel_block', {
      ...baseAuditMetadata,
      blockReason: 'opted_out',
      optOutId: optOut.id,
    });
    return {
      sent: false,
      blocked: true,
      blockReason: 'opted_out',
    };
  }

  // -----------------------------------------------------------
  // Sentinel 3: platform DNC
  // -----------------------------------------------------------
  const [platformDnc] = await db
    .select({ id: blockedNumbers.id, reason: blockedNumbers.reason })
    .from(blockedNumbers)
    .where(eq(blockedNumbers.phone, normalizedPhone))
    .limit(1);

  if (platformDnc) {
    await ComplianceService.logComplianceEvent(null, 'internal_sms_sentinel_block', {
      ...baseAuditMetadata,
      blockReason: 'platform_dnc',
      platformDncReason: platformDnc.reason,
    });
    return {
      sent: false,
      blocked: true,
      blockReason: 'platform_dnc',
    };
  }

  // Also check the legacy do_not_contact_list (no clientId scope = global)
  const dnc = await db.query.doNotContactList.findFirst({
    where: and(
      eq(doNotContactList.phoneNumberHash, phoneHash),
      eq(doNotContactList.isActive, true),
      isNull(doNotContactList.clientId)
    ),
  });
  if (dnc) {
    await ComplianceService.logComplianceEvent(null, 'internal_sms_sentinel_block', {
      ...baseAuditMetadata,
      blockReason: 'platform_dnc',
      dncSource: dnc.source,
    });
    return {
      sent: false,
      blocked: true,
      blockReason: 'platform_dnc',
    };
  }

  // -----------------------------------------------------------
  // All sentinels clear — send via privileged transport
  // -----------------------------------------------------------
  let messageSid: string;
  try {
    messageSid = await _sendSmsToTwilio(normalizedPhone, body, from);
  } catch (error) {
    await ComplianceService.logComplianceEvent(null, 'internal_sms_send_failed', {
      ...baseAuditMetadata,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  await ComplianceService.logComplianceEvent(null, 'internal_sms_sent', {
    ...baseAuditMetadata,
    messageSid,
  });

  return {
    sent: true,
    blocked: false,
    messageSid,
  };
}
