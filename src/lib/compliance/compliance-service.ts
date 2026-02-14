import {
  getDb,
  consentRecords,
  optOutRecords,
  doNotContactList,
  quietHoursConfig,
  complianceAuditLog,
  complianceCheckCache,
  leads,
} from '@/db';
import { eq, and, or, isNull, gte } from 'drizzle-orm';
import { createHash } from 'crypto';
import { getTimezoneOffset } from 'date-fns-tz';

// Standard opt-out keywords (case-insensitive)
const OPT_OUT_KEYWORDS = [
  'stop',
  'unsubscribe',
  'cancel',
  'end',
  'quit',
  'stopall',
  'stop all',
  'opt out',
  'optout',
  'remove',
];

// Standard opt-in keywords
const OPT_IN_KEYWORDS = [
  'start',
  'yes',
  'unstop',
  'subscribe',
  'optin',
  'opt in',
];

export interface ComplianceCheckResult {
  canSend: boolean;
  canSendMarketing: boolean;
  canSendTransactional: boolean;
  blockReason?: string;
  hasConsent: boolean;
  isOptedOut: boolean;
  isOnDnc: boolean;
  isQuietHours: boolean;
  consentId?: string;
  warnings: string[];
}

export class ComplianceService {
  /**
   * Hash phone number for privacy-preserving storage
   */
  static hashPhoneNumber(phoneNumber: string): string {
    const normalized = phoneNumber.replace(/\D/g, '');
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Normalize phone number to E.164 format
   */
  static normalizePhoneNumber(phoneNumber: string): string {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    if (!phoneNumber.startsWith('+')) {
      return `+${digits}`;
    }
    return phoneNumber;
  }

  /**
   * Check if a message is an opt-out request
   */
  static isOptOutMessage(message: string): boolean {
    const normalized = message.toLowerCase().trim();
    return OPT_OUT_KEYWORDS.some(
      (keyword) =>
        normalized === keyword || normalized.startsWith(keyword + ' ')
    );
  }

  /**
   * Check if a message is an opt-in request
   */
  static isOptInMessage(message: string): boolean {
    const normalized = message.toLowerCase().trim();
    return OPT_IN_KEYWORDS.some(
      (keyword) =>
        normalized === keyword || normalized.startsWith(keyword + ' ')
    );
  }

  /**
   * Full compliance check before sending a message
   */
  static async checkCompliance(
    clientId: string,
    phoneNumber: string,
    messageType: 'marketing' | 'transactional' = 'marketing',
    recipientTimezone?: string
  ): Promise<ComplianceCheckResult> {
    const db = getDb();
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    const phoneHash = this.hashPhoneNumber(normalizedPhone);
    const warnings: string[] = [];

    // Check cache first
    const cached = await this.getCachedCheck(clientId, normalizedPhone);
    if (cached && cached.expiresAt > new Date()) {
      const quietHoursResult = await this.isQuietHours(
        clientId,
        recipientTimezone
      );

      if (quietHoursResult.isQuietHours) {
        return {
          canSend: false,
          canSendMarketing: false,
          canSendTransactional: false,
          blockReason: quietHoursResult.reason,
          hasConsent: cached.hasValidConsent,
          isOptedOut: cached.isOptedOut,
          isOnDnc: cached.isOnDnc,
          isQuietHours: true,
          consentId: cached.consentId || undefined,
          warnings,
        };
      }

      return {
        canSend:
          messageType === 'marketing'
            ? cached.canReceiveMarketing
            : cached.canReceiveTransactional,
        canSendMarketing: cached.canReceiveMarketing,
        canSendTransactional: cached.canReceiveTransactional,
        blockReason:
          !cached.canReceiveMarketing && !cached.canReceiveTransactional
            ? 'No valid consent or opted out'
            : undefined,
        hasConsent: cached.hasValidConsent,
        isOptedOut: cached.isOptedOut,
        isOnDnc: cached.isOnDnc,
        isQuietHours: false,
        consentId: cached.consentId || undefined,
        warnings,
      };
    }

    // Check opt-out status
    const optOut = await db.query.optOutRecords.findFirst({
      where: and(
        eq(optOutRecords.clientId, clientId),
        eq(optOutRecords.phoneNumberHash, phoneHash),
        isNull(optOutRecords.reoptedInAt)
      ),
      orderBy: (records, { desc }) => [desc(records.optOutTimestamp)],
    });

    if (optOut) {
      await this.logComplianceEvent(clientId, 'message_blocked', {
        phoneNumber: normalizedPhone,
        phoneHash,
        reason: 'opted_out',
        optOutId: optOut.id,
      });

      return {
        canSend: false,
        canSendMarketing: false,
        canSendTransactional: false,
        blockReason: 'Recipient has opted out',
        hasConsent: false,
        isOptedOut: true,
        isOnDnc: false,
        isQuietHours: false,
        warnings,
      };
    }

    // Check DNC list (both global and client-specific)
    const dncEntry = await db.query.doNotContactList.findFirst({
      where: and(
        eq(doNotContactList.phoneNumberHash, phoneHash),
        eq(doNotContactList.isActive, true),
        or(
          isNull(doNotContactList.clientId),
          eq(doNotContactList.clientId, clientId)
        ),
        or(
          isNull(doNotContactList.expiresAt),
          gte(doNotContactList.expiresAt, new Date())
        )
      ),
    });

    if (dncEntry) {
      await this.logComplianceEvent(clientId, 'message_blocked', {
        phoneNumber: normalizedPhone,
        phoneHash,
        reason: 'dnc_list',
        dncSource: dncEntry.source,
      });

      return {
        canSend: false,
        canSendMarketing: false,
        canSendTransactional: dncEntry.source !== 'complaint',
        blockReason: `Number on Do Not Contact list (${dncEntry.source})`,
        hasConsent: false,
        isOptedOut: false,
        isOnDnc: true,
        isQuietHours: false,
        warnings,
      };
    }

    // Check consent
    const consent = await db.query.consentRecords.findFirst({
      where: and(
        eq(consentRecords.clientId, clientId),
        eq(consentRecords.phoneNumberHash, phoneHash),
        eq(consentRecords.isActive, true)
      ),
      orderBy: (records, { desc }) => [desc(records.consentTimestamp)],
    });

    if (!consent) {
      await this.logComplianceEvent(clientId, 'message_blocked', {
        phoneNumber: normalizedPhone,
        phoneHash,
        reason: 'no_consent',
      });

      warnings.push('No consent record found');

      return {
        canSend: false,
        canSendMarketing: false,
        canSendTransactional: false,
        blockReason: 'No valid consent record',
        hasConsent: false,
        isOptedOut: false,
        isOnDnc: false,
        isQuietHours: false,
        warnings,
      };
    }

    // Check consent scope
    const canSendMarketing =
      consent.consentScope.marketing || consent.consentScope.promotional;
    const canSendTransactional =
      consent.consentScope.transactional || consent.consentScope.reminders;

    // Check quiet hours
    const quietHoursResult = await this.isQuietHours(
      clientId,
      recipientTimezone
    );

    if (quietHoursResult.isQuietHours) {
      return {
        canSend: false,
        canSendMarketing: false,
        canSendTransactional: false,
        blockReason: quietHoursResult.reason,
        hasConsent: true,
        isOptedOut: false,
        isOnDnc: false,
        isQuietHours: true,
        consentId: consent.id,
        warnings,
      };
    }

    // CASL consent expiry enforcement
    const consentAge = Date.now() - consent.consentTimestamp.getTime();
    const sixMonths = 6 * 30 * 24 * 60 * 60 * 1000;
    const twoYears = 2 * 365 * 24 * 60 * 60 * 1000;

    if (consent.consentType === 'implied') {
      // CASL: Implied consent from inquiry expires after 6 months
      // Implied consent from existing customer expires after 2 years
      const isCustomerConsent =
        consent.consentSource === 'existing_customer';
      const expiryMs = isCustomerConsent ? twoYears : sixMonths;

      if (consentAge > expiryMs) {
        await this.logComplianceEvent(clientId, 'consent_expired', {
          phoneNumber: normalizedPhone,
          phoneHash,
          consentId: consent.id,
          consentType: consent.consentType,
          consentSource: consent.consentSource,
          ageMs: consentAge,
          expiryMs,
        });

        return {
          canSend: false,
          canSendMarketing: false,
          canSendTransactional: false,
          blockReason: `Implied consent expired (${isCustomerConsent ? '2 years' : '6 months'} under CASL)`,
          hasConsent: false,
          isOptedOut: false,
          isOnDnc: false,
          isQuietHours: false,
          warnings: ['Consent expired — re-confirmation required'],
        };
      }

      // Warn when approaching expiry (30 days before)
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (consentAge > expiryMs - thirtyDays) {
        warnings.push(
          `Implied consent expiring soon (${isCustomerConsent ? '2 years' : '6 months'} CASL limit) — consider re-confirmation`
        );
      }
    }

    // Warn if consent is over 1 year old even for express (best practice)
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    if (
      consent.consentType !== 'implied' &&
      consentAge > oneYear
    ) {
      warnings.push(
        'Consent is over 1 year old - consider re-confirming as best practice'
      );
    }

    // Cache the result
    await this.cacheComplianceCheck(clientId, normalizedPhone, phoneHash, {
      hasValidConsent: true,
      isOptedOut: false,
      isOnDnc: false,
      canReceiveMarketing: canSendMarketing,
      canReceiveTransactional: canSendTransactional,
      consentId: consent.id,
    });

    return {
      canSend:
        messageType === 'marketing' ? canSendMarketing : canSendTransactional,
      canSendMarketing,
      canSendTransactional,
      hasConsent: true,
      isOptedOut: false,
      isOnDnc: false,
      isQuietHours: false,
      consentId: consent.id,
      warnings,
    };
  }

  /**
   * Check if it's quiet hours for the recipient
   */
  static async isQuietHours(
    clientId: string,
    recipientTimezone?: string
  ): Promise<{ isQuietHours: boolean; reason?: string }> {
    const db = getDb();
    const config = await db.query.quietHoursConfig.findFirst({
      where: eq(quietHoursConfig.clientId, clientId),
    });

    if (!config || !config.enforceQuietHours) {
      return { isQuietHours: false };
    }

    // Get current hour in recipient's timezone
    const now = new Date();
    const timezone = recipientTimezone || 'America/New_York';

    // Calculate local hour
    const offset = getTimezoneOffset(timezone, now);
    const localTime = new Date(now.getTime() + offset);
    const localHour = localTime.getUTCHours();
    const dayOfWeek = localTime.getUTCDay();

    // Check if weekend and use weekend hours if configured
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const quietStart =
      isWeekend && config.weekendQuietStartHour !== null
        ? config.weekendQuietStartHour
        : config.quietStartHour;
    const quietEnd =
      isWeekend && config.weekendQuietEndHour !== null
        ? config.weekendQuietEndHour
        : config.quietEndHour;

    // Handle overnight quiet hours (e.g., 9 PM to 8 AM)
    const isQuietHours =
      quietStart > quietEnd
        ? localHour >= quietStart || localHour < quietEnd
        : localHour >= quietStart && localHour < quietEnd;

    if (isQuietHours) {
      return {
        isQuietHours: true,
        reason: `Quiet hours (${quietStart}:00 - ${quietEnd}:00 recipient's local time)`,
      };
    }

    // Check federal holidays if enabled
    if (config.respectFederalHolidays && config.holidayQuietAllDay) {
      const isHoliday = this.isFederalHoliday(localTime);
      if (isHoliday) {
        return {
          isQuietHours: true,
          reason: 'Federal holiday - no messages allowed',
        };
      }
    }

    return { isQuietHours: false };
  }

  /**
   * Check if date is a federal holiday
   */
  static isFederalHoliday(date: Date): boolean {
    const month = date.getMonth();
    const day = date.getDate();

    // Canadian federal holidays (CASL/CRTC jurisdiction)
    const fixedHolidays = [
      { month: 0, day: 1 }, // New Year's Day
      { month: 6, day: 1 }, // Canada Day
      { month: 8, day: 30 }, // National Day for Truth and Reconciliation (approx)
      { month: 10, day: 11 }, // Remembrance Day
      { month: 11, day: 25 }, // Christmas Day
      { month: 11, day: 26 }, // Boxing Day
    ];

    for (const holiday of fixedHolidays) {
      if (month === holiday.month && day === holiday.day) {
        return true;
      }
    }

    return false;
  }

  /**
   * Record an opt-out
   */
  static async recordOptOut(
    clientId: string,
    phoneNumber: string,
    reason:
      | 'stop_keyword'
      | 'unsubscribe_link'
      | 'manual_request'
      | 'complaint'
      | 'admin_removed'
      | 'dnc_match'
      | 'bounce',
    triggerMessage?: string,
    triggerMessageId?: string
  ): Promise<void> {
    const db = getDb();
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    const phoneHash = this.hashPhoneNumber(normalizedPhone);

    // Find associated lead
    const lead = await db.query.leads.findFirst({
      where: and(
        eq(leads.clientId, clientId),
        eq(leads.phone, normalizedPhone)
      ),
    });

    // Create opt-out record
    await db.insert(optOutRecords).values({
      clientId,
      leadId: lead?.id,
      phoneNumber: normalizedPhone,
      phoneNumberHash: phoneHash,
      optOutReason: reason,
      optOutTimestamp: new Date(),
      triggerMessage,
      triggerMessageId,
      processedAt: new Date(),
      processedBy: 'system',
    });

    // Invalidate any existing consent
    await db
      .update(consentRecords)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokedReason: `Opted out: ${reason}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(consentRecords.clientId, clientId),
          eq(consentRecords.phoneNumberHash, phoneHash),
          eq(consentRecords.isActive, true)
        )
      );

    // Clear cache
    await db
      .delete(complianceCheckCache)
      .where(
        and(
          eq(complianceCheckCache.clientId, clientId),
          eq(complianceCheckCache.phoneNumberHash, phoneHash)
        )
      );

    // Log the event
    await this.logComplianceEvent(clientId, 'opt_out_recorded', {
      phoneNumber: normalizedPhone,
      phoneHash,
      reason,
      leadId: lead?.id,
    });
  }

  /**
   * Record consent
   */
  static async recordConsent(
    clientId: string,
    phoneNumber: string,
    consent: {
      type:
        | 'express_written'
        | 'express_oral'
        | 'implied'
        | 'transactional';
      source:
        | 'web_form'
        | 'text_optin'
        | 'paper_form'
        | 'phone_recording'
        | 'existing_customer'
        | 'manual_entry'
        | 'api_import';
      scope: {
        marketing: boolean;
        transactional: boolean;
        promotional: boolean;
        reminders: boolean;
      };
      language: string;
      ipAddress?: string;
      userAgent?: string;
      formUrl?: string;
      signatureImage?: string;
      recordingUrl?: string;
    }
  ): Promise<string> {
    const db = getDb();
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    const phoneHash = this.hashPhoneNumber(normalizedPhone);

    // Find associated lead
    const lead = await db.query.leads.findFirst({
      where: and(
        eq(leads.clientId, clientId),
        eq(leads.phone, normalizedPhone)
      ),
    });

    // Check if they had previously opted out
    const previousOptOut = await db.query.optOutRecords.findFirst({
      where: and(
        eq(optOutRecords.clientId, clientId),
        eq(optOutRecords.phoneNumberHash, phoneHash),
        isNull(optOutRecords.reoptedInAt)
      ),
    });

    // Create consent record
    const [newConsent] = await db
      .insert(consentRecords)
      .values({
        clientId,
        leadId: lead?.id,
        phoneNumber: normalizedPhone,
        phoneNumberHash: phoneHash,
        consentType: consent.type,
        consentSource: consent.source,
        consentScope: consent.scope,
        consentLanguage: consent.language,
        consentTimestamp: new Date(),
        ipAddress: consent.ipAddress,
        userAgent: consent.userAgent,
        formUrl: consent.formUrl,
        signatureImage: consent.signatureImage,
        recordingUrl: consent.recordingUrl,
        isActive: true,
      })
      .returning();

    // If they had opted out, mark as re-opted in
    if (previousOptOut) {
      await db
        .update(optOutRecords)
        .set({
          reoptedInAt: new Date(),
          reoptinConsentId: newConsent.id,
        })
        .where(eq(optOutRecords.id, previousOptOut.id));
    }

    // Clear cache
    await db
      .delete(complianceCheckCache)
      .where(
        and(
          eq(complianceCheckCache.clientId, clientId),
          eq(complianceCheckCache.phoneNumberHash, phoneHash)
        )
      );

    // Log the event
    await this.logComplianceEvent(clientId, 'consent_recorded', {
      phoneNumber: normalizedPhone,
      phoneHash,
      consentId: newConsent.id,
      consentType: consent.type,
      consentSource: consent.source,
      leadId: lead?.id,
      reoptedIn: !!previousOptOut,
    });

    return newConsent.id;
  }

  /**
   * Log a compliance event
   */
  static async logComplianceEvent(
    clientId: string | null,
    eventType: string,
    eventData: Record<string, unknown>,
    actor: { type: string; id?: string } = { type: 'system' }
  ): Promise<void> {
    const db = getDb();
    await db.insert(complianceAuditLog).values({
      clientId,
      eventType,
      eventTimestamp: new Date(),
      phoneNumber: eventData.phoneNumber as string | undefined,
      phoneNumberHash: eventData.phoneHash as string | undefined,
      leadId: eventData.leadId as string | undefined,
      messageId: eventData.messageId as string | undefined,
      consentId: eventData.consentId as string | undefined,
      eventData,
      actorType: actor.type,
      actorId: actor.id,
      success: true,
    });
  }

  /**
   * Get cached compliance check
   */
  private static async getCachedCheck(
    clientId: string,
    phoneNumber: string
  ) {
    const db = getDb();
    const phoneHash = this.hashPhoneNumber(phoneNumber);
    return db.query.complianceCheckCache.findFirst({
      where: and(
        eq(complianceCheckCache.clientId, clientId),
        eq(complianceCheckCache.phoneNumberHash, phoneHash)
      ),
    });
  }

  /**
   * Cache compliance check result
   */
  private static async cacheComplianceCheck(
    clientId: string,
    phoneNumber: string,
    phoneHash: string,
    result: {
      hasValidConsent: boolean;
      isOptedOut: boolean;
      isOnDnc: boolean;
      canReceiveMarketing: boolean;
      canReceiveTransactional: boolean;
      consentId?: string;
    }
  ): Promise<void> {
    const db = getDb();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minute cache

    // Delete existing cache entry and insert fresh
    await db
      .delete(complianceCheckCache)
      .where(
        and(
          eq(complianceCheckCache.clientId, clientId),
          eq(complianceCheckCache.phoneNumber, phoneNumber)
        )
      );

    await db.insert(complianceCheckCache).values({
      clientId,
      phoneNumber,
      phoneNumberHash: phoneHash,
      ...result,
      lastCheckedAt: new Date(),
      expiresAt,
    });
  }
}
