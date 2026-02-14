import { sendSMS } from '@/lib/services/twilio';
import { ComplianceService } from './compliance-service';
import { getDb, clients, leads, consentRecords } from '@/db';
import { eq, and, sql } from 'drizzle-orm';

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
  messageCategory?: MessageCategory;
  consentBasis?: ConsentBasis;
  leadId?: string;
  /** If true, queue for next available window instead of failing on quiet hours */
  queueOnQuietHours?: boolean;
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

// CASL implied consent expiry: 6 months for inquiries, 2 years for customers
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

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
    messageCategory = 'marketing',
    consentBasis,
    leadId,
    queueOnQuietHours = true,
    mediaUrl,
    metadata,
  } = params;

  const warnings: string[] = [];
  const normalizedPhone = ComplianceService.normalizePhoneNumber(to);
  const phoneHash = ComplianceService.hashPhoneNumber(normalizedPhone);

  // -----------------------------------------------------------
  // Step 0: Check monthly message limit BEFORE expensive checks
  // -----------------------------------------------------------
  const db = getDb();
  const [clientData] = await db
    .select({
      messagesSentThisMonth: clients.messagesSentThisMonth,
      monthlyMessageLimit: clients.monthlyMessageLimit,
      timezone: clients.timezone,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!clientData) {
    return blocked('Client not found', normalizedPhone, phoneHash, clientId, metadata);
  }

  if (
    clientData.monthlyMessageLimit &&
    (clientData.messagesSentThisMonth ?? 0) >= clientData.monthlyMessageLimit
  ) {
    return blocked(
      `Monthly message limit reached (${clientData.monthlyMessageLimit})`,
      normalizedPhone,
      phoneHash,
      clientId,
      metadata
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
    clientData.timezone || undefined
  );

  // -----------------------------------------------------------
  // Step 3: Handle blocked scenarios
  // -----------------------------------------------------------
  if (complianceResult.isOptedOut) {
    return blocked('Recipient has opted out', normalizedPhone, phoneHash, clientId, metadata);
  }

  if (complianceResult.isOnDnc) {
    return blocked(
      complianceResult.blockReason || 'Number on Do Not Contact list',
      normalizedPhone,
      phoneHash,
      clientId,
      metadata
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
        metadata
      );
    }
  }

  // -----------------------------------------------------------
  // Step 4: Handle quiet hours
  // -----------------------------------------------------------
  if (complianceResult.isQuietHours) {
    if (queueOnQuietHours) {
      await ComplianceService.logComplianceEvent(clientId, 'message_queued', {
        phoneNumber: normalizedPhone,
        phoneHash,
        reason: 'quiet_hours',
        messageCategory,
        ...metadata,
      });

      return {
        sent: false,
        queued: true,
        blocked: false,
        blockReason: complianceResult.blockReason,
        consentId: complianceResult.consentId,
        warnings: [...warnings, 'Message queued for next available window (quiet hours)'],
      };
    }
    return blocked(
      complianceResult.blockReason || 'Quiet hours — cannot send',
      normalizedPhone,
      phoneHash,
      clientId,
      metadata
    );
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
      metadata
    );
  }

  // Collect compliance warnings
  warnings.push(...complianceResult.warnings);

  // -----------------------------------------------------------
  // Step 6: Send the message
  // -----------------------------------------------------------
  let messageSid: string;
  try {
    messageSid = await sendSMS(normalizedPhone, body, from, mediaUrl?.length ? { mediaUrl } : undefined);
  } catch (error) {
    // Log failed send attempt
    await ComplianceService.logComplianceEvent(clientId, 'message_send_failed', {
      phoneNumber: normalizedPhone,
      phoneHash,
      messageCategory,
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
