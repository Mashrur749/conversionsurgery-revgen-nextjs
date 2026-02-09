# Phase 43: TCPA Compliance & Consent Management

## Overview
Complete TCPA (Telephone Consumer Protection Act) compliance system including opt-out tracking, consent logging, do-not-contact lists, quiet hours enforcement, and compliance audit reporting. Critical for legal protection when sending automated SMS messages.

## Dependencies
- Phase 01: Database setup
- Phase 03: Core automations (SMS sending)
- Phase 12b: CRM conversations (lead records)

## Regulatory Background

### TCPA Requirements Summary
1. **Prior Express Written Consent**: Must have documented consent before sending marketing messages
2. **Opt-Out Mechanism**: Must honor STOP requests within reasonable time
3. **Quiet Hours**: Cannot send messages before 8 AM or after 9 PM recipient's local time
4. **DNC Compliance**: Must scrub against National Do Not Call Registry
5. **Record Keeping**: Must maintain consent records for 4+ years
6. **Clear Identification**: Messages must identify sender

## Schema Design

### File: `src/db/schema/compliance.ts`

```typescript
import { pgTable, text, timestamp, uuid, boolean, jsonb, pgEnum, index, integer, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { clients } from './clients';
import { leads } from './leads';

// Consent type
export const consentTypeEnum = pgEnum('consent_type', [
  'express_written',  // Best: signed form, web form with checkbox
  'express_oral',     // Good: verbal consent (recorded)
  'implied',          // Weaker: existing business relationship
  'transactional',    // For transactional messages only
]);

// Consent source
export const consentSourceEnum = pgEnum('consent_source', [
  'web_form',         // Website contact form
  'text_optin',       // Texted keyword to opt in
  'paper_form',       // Physical signed document
  'phone_recording',  // Recorded verbal consent
  'existing_customer', // Prior business relationship
  'manual_entry',     // Admin manually added
  'api_import',       // Imported via API
]);

// Opt-out reason
export const optOutReasonEnum = pgEnum('opt_out_reason', [
  'stop_keyword',     // Replied STOP
  'unsubscribe_link', // Clicked unsubscribe
  'manual_request',   // Called/emailed to opt out
  'complaint',        // Filed complaint
  'admin_removed',    // Admin removed
  'dnc_match',        // Matched DNC registry
  'bounce',           // Number invalid/disconnected
]);

// ============================================
// CONSENT RECORDS
// ============================================
export const consentRecords = pgTable('consent_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  leadId: uuid('lead_id').references(() => leads.id),
  
  // Contact info
  phoneNumber: text('phone_number').notNull(),    // E.164 format
  phoneNumberHash: text('phone_number_hash').notNull(), // For privacy-preserving lookups
  
  // Consent details
  consentType: consentTypeEnum('consent_type').notNull(),
  consentSource: consentSourceEnum('consent_source').notNull(),
  
  // What they consented to
  consentScope: jsonb('consent_scope').$type<{
    marketing: boolean;
    transactional: boolean;
    promotional: boolean;
    reminders: boolean;
  }>().notNull(),
  
  // Consent language shown
  consentLanguage: text('consent_language').notNull(),
  
  // Evidence
  consentTimestamp: timestamp('consent_timestamp').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  formUrl: text('form_url'),
  signatureImage: text('signature_image'),      // Base64 if paper form scanned
  recordingUrl: text('recording_url'),          // If verbal consent recorded
  
  // Status
  isActive: boolean('is_active').default(true),
  revokedAt: timestamp('revoked_at'),
  revokedReason: text('revoked_reason'),
  
  // Metadata
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  clientPhoneIdx: index('idx_consent_client_phone').on(table.clientId, table.phoneNumber),
  phoneHashIdx: index('idx_consent_phone_hash').on(table.phoneNumberHash),
  leadIdx: index('idx_consent_lead').on(table.leadId),
  activeIdx: index('idx_consent_active').on(table.clientId, table.isActive),
}));

// ============================================
// OPT-OUT RECORDS
// ============================================
export const optOutRecords = pgTable('opt_out_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  leadId: uuid('lead_id').references(() => leads.id),
  
  // Contact info
  phoneNumber: text('phone_number').notNull(),
  phoneNumberHash: text('phone_number_hash').notNull(),
  
  // Opt-out details
  optOutReason: optOutReasonEnum('opt_out_reason').notNull(),
  optOutTimestamp: timestamp('opt_out_timestamp').notNull().defaultNow(),
  
  // Evidence
  triggerMessage: text('trigger_message'),      // The message that triggered opt-out
  triggerMessageId: uuid('trigger_message_id'), // Reference to the message
  
  // Processing
  processedAt: timestamp('processed_at'),
  processedBy: text('processed_by'),            // 'system' or admin user ID
  
  // Reopt-in tracking
  reoptedInAt: timestamp('reopted_in_at'),
  reoptinConsentId: uuid('reoptin_consent_id').references(() => consentRecords.id),
  
  // Metadata
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  clientPhoneIdx: index('idx_optout_client_phone').on(table.clientId, table.phoneNumber),
  phoneHashIdx: index('idx_optout_phone_hash').on(table.phoneNumberHash),
  timestampIdx: index('idx_optout_timestamp').on(table.optOutTimestamp),
}));

// ============================================
// DO NOT CONTACT LIST
// ============================================
export const doNotContactList = pgTable('do_not_contact_list', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Scope: null = global, clientId = client-specific
  clientId: uuid('client_id').references(() => clients.id),
  
  // Contact info
  phoneNumber: text('phone_number').notNull(),
  phoneNumberHash: text('phone_number_hash').notNull(),
  
  // Source
  source: text('source').notNull(),             // 'national_dnc', 'state_dnc', 'internal', 'complaint'
  sourceReference: text('source_reference'),     // External ID or reference
  
  // Validity
  addedAt: timestamp('added_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),           // Some DNC entries expire
  
  // Status
  isActive: boolean('is_active').default(true),
  removedAt: timestamp('removed_at'),
  removeReason: text('remove_reason'),
  
  // Metadata
  metadata: jsonb('metadata'),
}, (table) => ({
  phoneHashIdx: index('idx_dnc_phone_hash').on(table.phoneNumberHash),
  clientPhoneIdx: index('idx_dnc_client_phone').on(table.clientId, table.phoneNumber),
  sourceIdx: index('idx_dnc_source').on(table.source),
  activeIdx: index('idx_dnc_active').on(table.isActive),
}));

// ============================================
// QUIET HOURS CONFIGURATION
// ============================================
export const quietHoursConfig = pgTable('quiet_hours_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id).unique(),
  
  // Standard quiet hours (recipient's local time)
  quietStartHour: integer('quiet_start_hour').notNull().default(21),  // 9 PM
  quietEndHour: integer('quiet_end_hour').notNull().default(8),       // 8 AM
  
  // Day-specific overrides (0 = Sunday, 6 = Saturday)
  weekendQuietStartHour: integer('weekend_quiet_start_hour'),
  weekendQuietEndHour: integer('weekend_quiet_end_hour'),
  
  // Holiday handling
  respectFederalHolidays: boolean('respect_federal_holidays').default(true),
  holidayQuietAllDay: boolean('holiday_quiet_all_day').default(false),
  
  // Enforcement
  enforceQuietHours: boolean('enforce_quiet_hours').default(true),
  queueDuringQuietHours: boolean('queue_during_quiet_hours').default(true),
  
  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// COMPLIANCE AUDIT LOG
// ============================================
export const complianceAuditLog = pgTable('compliance_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id),
  
  // Event details
  eventType: text('event_type').notNull(),      // 'consent_captured', 'opt_out', 'message_blocked', etc.
  eventTimestamp: timestamp('event_timestamp').notNull().defaultNow(),
  
  // Related records
  phoneNumber: text('phone_number'),
  phoneNumberHash: text('phone_number_hash'),
  leadId: uuid('lead_id'),
  messageId: uuid('message_id'),
  consentId: uuid('consent_id'),
  
  // Event data
  eventData: jsonb('event_data'),
  
  // Actor
  actorType: text('actor_type').notNull(),      // 'system', 'user', 'webhook', 'cron'
  actorId: text('actor_id'),
  
  // Result
  success: boolean('success').notNull(),
  errorMessage: text('error_message'),
  
  // Metadata
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
}, (table) => ({
  clientEventIdx: index('idx_audit_client_event').on(table.clientId, table.eventType),
  timestampIdx: index('idx_audit_timestamp').on(table.eventTimestamp),
  phoneHashIdx: index('idx_audit_phone_hash').on(table.phoneNumberHash),
}));

// ============================================
// MESSAGE COMPLIANCE CHECK CACHE
// ============================================
export const complianceCheckCache = pgTable('compliance_check_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  phoneNumber: text('phone_number').notNull(),
  phoneNumberHash: text('phone_number_hash').notNull(),
  
  // Check results
  hasValidConsent: boolean('has_valid_consent').notNull(),
  isOptedOut: boolean('is_opted_out').notNull(),
  isOnDnc: boolean('is_on_dnc').notNull(),
  canReceiveMarketing: boolean('can_receive_marketing').notNull(),
  canReceiveTransactional: boolean('can_receive_transactional').notNull(),
  
  // Timestamps
  lastCheckedAt: timestamp('last_checked_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  
  // References
  consentId: uuid('consent_id').references(() => consentRecords.id),
  optOutId: uuid('opt_out_id').references(() => optOutRecords.id),
}, (table) => ({
  clientPhoneIdx: index('idx_cache_client_phone').on(table.clientId, table.phoneNumber),
  expiresIdx: index('idx_cache_expires').on(table.expiresAt),
}));

// ============================================
// RELATIONS
// ============================================
export const consentRecordsRelations = relations(consentRecords, ({ one }) => ({
  client: one(clients, {
    fields: [consentRecords.clientId],
    references: [clients.id],
  }),
  lead: one(leads, {
    fields: [consentRecords.leadId],
    references: [leads.id],
  }),
}));

export const optOutRecordsRelations = relations(optOutRecords, ({ one }) => ({
  client: one(clients, {
    fields: [optOutRecords.clientId],
    references: [clients.id],
  }),
  lead: one(leads, {
    fields: [optOutRecords.leadId],
    references: [leads.id],
  }),
  reoptinConsent: one(consentRecords, {
    fields: [optOutRecords.reoptinConsentId],
    references: [consentRecords.id],
  }),
}));
```

## Compliance Service

### File: `src/lib/compliance/compliance-service.ts`

```typescript
import { db } from '@/db';
import {
  consentRecords,
  optOutRecords,
  doNotContactList,
  quietHoursConfig,
  complianceAuditLog,
  complianceCheckCache,
} from '@/db/schema/compliance';
import { eq, and, or, isNull, gte, lte } from 'drizzle-orm';
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
    return OPT_OUT_KEYWORDS.some(keyword => 
      normalized === keyword || normalized.startsWith(keyword + ' ')
    );
  }

  /**
   * Check if a message is an opt-in request
   */
  static isOptInMessage(message: string): boolean {
    const normalized = message.toLowerCase().trim();
    return OPT_IN_KEYWORDS.some(keyword => 
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
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    const phoneHash = this.hashPhoneNumber(normalizedPhone);
    const warnings: string[] = [];

    // Check cache first
    const cached = await this.getCachedCheck(clientId, normalizedPhone);
    if (cached && cached.expiresAt > new Date()) {
      // Still need to check quiet hours as they're time-dependent
      const quietHoursResult = await this.isQuietHours(clientId, recipientTimezone);
      
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
        canSend: messageType === 'marketing' ? cached.canReceiveMarketing : cached.canReceiveTransactional,
        canSendMarketing: cached.canReceiveMarketing,
        canSendTransactional: cached.canReceiveTransactional,
        blockReason: !cached.canReceiveMarketing && !cached.canReceiveTransactional 
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
        canSendTransactional: dncEntry.source !== 'complaint', // Allow transactional unless complaint
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
      // No consent - block marketing, might allow transactional with warning
      await this.logComplianceEvent(clientId, 'message_blocked', {
        phoneNumber: normalizedPhone,
        phoneHash,
        reason: 'no_consent',
      });

      warnings.push('No consent record found');

      return {
        canSend: false,
        canSendMarketing: false,
        canSendTransactional: false, // Strict mode - require consent for all
        blockReason: 'No valid consent record',
        hasConsent: false,
        isOptedOut: false,
        isOnDnc: false,
        isQuietHours: false,
        warnings,
      };
    }

    // Check consent scope
    const canSendMarketing = consent.consentScope.marketing || consent.consentScope.promotional;
    const canSendTransactional = consent.consentScope.transactional || consent.consentScope.reminders;

    // Check quiet hours
    const quietHoursResult = await this.isQuietHours(clientId, recipientTimezone);
    
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

    // Warn if consent is old
    const consentAge = Date.now() - consent.consentTimestamp.getTime();
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    if (consentAge > oneYear) {
      warnings.push('Consent is over 1 year old - consider re-confirming');
    }

    // Warn if consent type is weak
    if (consent.consentType === 'implied') {
      warnings.push('Consent is implied only - express written consent is recommended');
    }

    // Cache the result
    await this.cacheComplianceCheck(clientId, normalizedPhone, phoneHash, {
      hasValidConsent: true,
      isOptedOut: false,
      isOnDnc: false,
      canReceiveMarketing,
      canReceiveTransactional,
      consentId: consent.id,
    });

    return {
      canSend: messageType === 'marketing' ? canSendMarketing : canSendTransactional,
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
    const config = await db.query.quietHoursConfig.findFirst({
      where: eq(quietHoursConfig.clientId, clientId),
    });

    if (!config || !config.enforceQuietHours) {
      return { isQuietHours: false };
    }

    // Get current hour in recipient's timezone
    const now = new Date();
    const timezone = recipientTimezone || 'America/New_York'; // Default to ET
    
    // Calculate local hour
    const offset = getTimezoneOffset(timezone, now);
    const localTime = new Date(now.getTime() + offset);
    const localHour = localTime.getUTCHours();
    const dayOfWeek = localTime.getUTCDay();

    // Check if weekend and use weekend hours if configured
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const quietStart = isWeekend && config.weekendQuietStartHour !== null
      ? config.weekendQuietStartHour
      : config.quietStartHour;
    const quietEnd = isWeekend && config.weekendQuietEndHour !== null
      ? config.weekendQuietEndHour
      : config.quietEndHour;

    // Handle overnight quiet hours (e.g., 9 PM to 8 AM)
    const isQuietHours = quietStart > quietEnd
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
      const isHoliday = await this.isFederalHoliday(localTime);
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
  static async isFederalHoliday(date: Date): Promise<boolean> {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const dayOfWeek = date.getDay();

    // Fixed holidays
    const fixedHolidays = [
      { month: 0, day: 1 },   // New Year's Day
      { month: 6, day: 4 },   // Independence Day
      { month: 10, day: 11 }, // Veterans Day
      { month: 11, day: 25 }, // Christmas
    ];

    for (const holiday of fixedHolidays) {
      if (month === holiday.month && day === holiday.day) {
        return true;
      }
    }

    // Floating holidays (simplified - would need more complex calculation)
    // MLK Day: 3rd Monday in January
    // Presidents Day: 3rd Monday in February
    // Memorial Day: Last Monday in May
    // Labor Day: 1st Monday in September
    // Thanksgiving: 4th Thursday in November

    return false;
  }

  /**
   * Record an opt-out
   */
  static async recordOptOut(
    clientId: string,
    phoneNumber: string,
    reason: 'stop_keyword' | 'unsubscribe_link' | 'manual_request' | 'complaint' | 'admin_removed' | 'dnc_match' | 'bounce',
    triggerMessage?: string,
    triggerMessageId?: string
  ): Promise<void> {
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
    await db.update(consentRecords)
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
    await db.delete(complianceCheckCache)
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
      type: 'express_written' | 'express_oral' | 'implied' | 'transactional';
      source: 'web_form' | 'text_optin' | 'paper_form' | 'phone_recording' | 'existing_customer' | 'manual_entry' | 'api_import';
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
    const [newConsent] = await db.insert(consentRecords)
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
      await db.update(optOutRecords)
        .set({
          reoptedInAt: new Date(),
          reoptinConsentId: newConsent.id,
        })
        .where(eq(optOutRecords.id, previousOptOut.id));
    }

    // Clear cache
    await db.delete(complianceCheckCache)
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
  private static async getCachedCheck(clientId: string, phoneNumber: string) {
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
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minute cache

    await db.insert(complianceCheckCache)
      .values({
        clientId,
        phoneNumber,
        phoneNumberHash: phoneHash,
        ...result,
        lastCheckedAt: new Date(),
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [complianceCheckCache.clientId, complianceCheckCache.phoneNumber],
        set: {
          ...result,
          lastCheckedAt: new Date(),
          expiresAt,
        },
      });
  }
}
```

## Opt-Out Message Handler

### File: `src/lib/compliance/opt-out-handler.ts`

```typescript
import { ComplianceService } from './compliance-service';
import { db } from '@/db';
import { leads } from '@/db/schema/leads';
import { eq, and } from 'drizzle-orm';

interface InboundMessage {
  from: string;
  to: string;
  body: string;
  messageId: string;
  clientId: string;
}

interface OptOutResponse {
  isOptOut: boolean;
  isOptIn: boolean;
  handled: boolean;
  responseMessage?: string;
}

export async function handleInboundMessage(message: InboundMessage): Promise<OptOutResponse> {
  const { from, body, messageId, clientId } = message;

  // Check for opt-out keywords
  if (ComplianceService.isOptOutMessage(body)) {
    await ComplianceService.recordOptOut(
      clientId,
      from,
      'stop_keyword',
      body,
      messageId
    );

    // Update lead status if exists
    const normalizedPhone = ComplianceService.normalizePhoneNumber(from);
    await db.update(leads)
      .set({
        status: 'opted_out',
        optedOutAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(leads.clientId, clientId),
          eq(leads.phone, normalizedPhone)
        )
      );

    return {
      isOptOut: true,
      isOptIn: false,
      handled: true,
      responseMessage: 'You have been unsubscribed and will no longer receive messages from us. Reply START to resubscribe.',
    };
  }

  // Check for opt-in keywords
  if (ComplianceService.isOptInMessage(body)) {
    // Re-consent via text opt-in
    await ComplianceService.recordConsent(
      clientId,
      from,
      {
        type: 'express_written',
        source: 'text_optin',
        scope: {
          marketing: true,
          transactional: true,
          promotional: true,
          reminders: true,
        },
        language: 'By replying START, you consent to receive automated text messages from us. Reply STOP to unsubscribe.',
      }
    );

    // Update lead status
    const normalizedPhone = ComplianceService.normalizePhoneNumber(from);
    await db.update(leads)
      .set({
        status: 'active',
        optedOutAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(leads.clientId, clientId),
          eq(leads.phone, normalizedPhone)
        )
      );

    return {
      isOptOut: false,
      isOptIn: true,
      handled: true,
      responseMessage: 'You have been resubscribed! You will now receive messages from us. Reply STOP to unsubscribe.',
    };
  }

  return {
    isOptOut: false,
    isOptIn: false,
    handled: false,
  };
}
```

## DNC List Management

### File: `src/lib/compliance/dnc-service.ts`

```typescript
import { db } from '@/db';
import { doNotContactList } from '@/db/schema/compliance';
import { ComplianceService } from './compliance-service';
import { eq, and, or, isNull, inArray } from 'drizzle-orm';

export interface DncImportResult {
  total: number;
  added: number;
  duplicates: number;
  errors: number;
}

export class DncService {
  /**
   * Add a single number to DNC list
   */
  static async addToDnc(
    phoneNumber: string,
    source: string,
    clientId?: string,
    sourceReference?: string,
    expiresAt?: Date
  ): Promise<void> {
    const normalizedPhone = ComplianceService.normalizePhoneNumber(phoneNumber);
    const phoneHash = ComplianceService.hashPhoneNumber(normalizedPhone);

    // Check if already exists
    const existing = await db.query.doNotContactList.findFirst({
      where: and(
        eq(doNotContactList.phoneNumberHash, phoneHash),
        clientId ? eq(doNotContactList.clientId, clientId) : isNull(doNotContactList.clientId),
        eq(doNotContactList.isActive, true)
      ),
    });

    if (existing) {
      return; // Already on list
    }

    await db.insert(doNotContactList).values({
      clientId,
      phoneNumber: normalizedPhone,
      phoneNumberHash: phoneHash,
      source,
      sourceReference,
      expiresAt,
      isActive: true,
    });

    await ComplianceService.logComplianceEvent(clientId || null, 'dnc_added', {
      phoneNumber: normalizedPhone,
      phoneHash,
      source,
    });
  }

  /**
   * Remove from DNC list
   */
  static async removeFromDnc(
    phoneNumber: string,
    clientId?: string,
    reason?: string
  ): Promise<void> {
    const normalizedPhone = ComplianceService.normalizePhoneNumber(phoneNumber);
    const phoneHash = ComplianceService.hashPhoneNumber(normalizedPhone);

    await db.update(doNotContactList)
      .set({
        isActive: false,
        removedAt: new Date(),
        removeReason: reason,
      })
      .where(
        and(
          eq(doNotContactList.phoneNumberHash, phoneHash),
          clientId ? eq(doNotContactList.clientId, clientId) : isNull(doNotContactList.clientId),
          eq(doNotContactList.isActive, true)
        )
      );

    await ComplianceService.logComplianceEvent(clientId || null, 'dnc_removed', {
      phoneNumber: normalizedPhone,
      phoneHash,
      reason,
    });
  }

  /**
   * Bulk import DNC list (e.g., from national registry)
   */
  static async bulkImport(
    phoneNumbers: string[],
    source: string,
    clientId?: string
  ): Promise<DncImportResult> {
    const result: DncImportResult = {
      total: phoneNumbers.length,
      added: 0,
      duplicates: 0,
      errors: 0,
    };

    // Batch process in chunks of 1000
    const chunkSize = 1000;
    for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
      const chunk = phoneNumbers.slice(i, i + chunkSize);
      
      const records = chunk.map(phone => {
        try {
          const normalizedPhone = ComplianceService.normalizePhoneNumber(phone);
          const phoneHash = ComplianceService.hashPhoneNumber(normalizedPhone);
          return {
            clientId,
            phoneNumber: normalizedPhone,
            phoneNumberHash: phoneHash,
            source,
            isActive: true,
          };
        } catch {
          result.errors++;
          return null;
        }
      }).filter(Boolean);

      // Get existing hashes
      const hashes = records.map(r => r!.phoneNumberHash);
      const existing = await db
        .select({ phoneNumberHash: doNotContactList.phoneNumberHash })
        .from(doNotContactList)
        .where(
          and(
            inArray(doNotContactList.phoneNumberHash, hashes),
            eq(doNotContactList.isActive, true)
          )
        );

      const existingSet = new Set(existing.map(e => e.phoneNumberHash));
      
      const newRecords = records.filter(r => r && !existingSet.has(r.phoneNumberHash));
      result.duplicates += records.length - newRecords.length;

      if (newRecords.length > 0) {
        await db.insert(doNotContactList).values(newRecords as any[]);
        result.added += newRecords.length;
      }
    }

    await ComplianceService.logComplianceEvent(clientId || null, 'dnc_bulk_import', {
      source,
      ...result,
    });

    return result;
  }

  /**
   * Check if number is on DNC list
   */
  static async isOnDnc(phoneNumber: string, clientId?: string): Promise<boolean> {
    const phoneHash = ComplianceService.hashPhoneNumber(
      ComplianceService.normalizePhoneNumber(phoneNumber)
    );

    const entry = await db.query.doNotContactList.findFirst({
      where: and(
        eq(doNotContactList.phoneNumberHash, phoneHash),
        eq(doNotContactList.isActive, true),
        or(
          isNull(doNotContactList.clientId),
          clientId ? eq(doNotContactList.clientId, clientId) : undefined
        )
      ),
    });

    return !!entry;
  }
}
```

## Compliance Report Generator

### File: `src/lib/compliance/report-generator.ts`

```typescript
import { db } from '@/db';
import {
  consentRecords,
  optOutRecords,
  doNotContactList,
  complianceAuditLog,
} from '@/db/schema/compliance';
import { eq, and, gte, lte, count, sql } from 'drizzle-orm';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

export interface ComplianceReport {
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalConsents: number;
    activeConsents: number;
    totalOptOuts: number;
    optOutRate: number;
    dncListSize: number;
    messagesBlocked: number;
  };
  consentBreakdown: {
    byType: Record<string, number>;
    bySource: Record<string, number>;
  };
  optOutBreakdown: {
    byReason: Record<string, number>;
    trend: { date: string; count: number }[];
  };
  complianceEvents: {
    type: string;
    count: number;
  }[];
  risks: string[];
  recommendations: string[];
}

export class ComplianceReportGenerator {
  /**
   * Generate comprehensive compliance report
   */
  static async generateReport(
    clientId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    // Get consent stats
    const [totalConsents] = await db
      .select({ count: count() })
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.clientId, clientId),
          gte(consentRecords.createdAt, startDate),
          lte(consentRecords.createdAt, endDate)
        )
      );

    const [activeConsents] = await db
      .select({ count: count() })
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.clientId, clientId),
          eq(consentRecords.isActive, true)
        )
      );

    // Get opt-out stats
    const [totalOptOuts] = await db
      .select({ count: count() })
      .from(optOutRecords)
      .where(
        and(
          eq(optOutRecords.clientId, clientId),
          gte(optOutRecords.createdAt, startDate),
          lte(optOutRecords.createdAt, endDate)
        )
      );

    // Get DNC list size
    const [dncSize] = await db
      .select({ count: count() })
      .from(doNotContactList)
      .where(eq(doNotContactList.isActive, true));

    // Get blocked messages count
    const [blockedMessages] = await db
      .select({ count: count() })
      .from(complianceAuditLog)
      .where(
        and(
          eq(complianceAuditLog.clientId, clientId),
          eq(complianceAuditLog.eventType, 'message_blocked'),
          gte(complianceAuditLog.eventTimestamp, startDate),
          lte(complianceAuditLog.eventTimestamp, endDate)
        )
      );

    // Consent breakdown by type
    const consentByType = await db
      .select({
        type: consentRecords.consentType,
        count: count(),
      })
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.clientId, clientId),
          gte(consentRecords.createdAt, startDate),
          lte(consentRecords.createdAt, endDate)
        )
      )
      .groupBy(consentRecords.consentType);

    // Consent breakdown by source
    const consentBySource = await db
      .select({
        source: consentRecords.consentSource,
        count: count(),
      })
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.clientId, clientId),
          gte(consentRecords.createdAt, startDate),
          lte(consentRecords.createdAt, endDate)
        )
      )
      .groupBy(consentRecords.consentSource);

    // Opt-out breakdown by reason
    const optOutByReason = await db
      .select({
        reason: optOutRecords.optOutReason,
        count: count(),
      })
      .from(optOutRecords)
      .where(
        and(
          eq(optOutRecords.clientId, clientId),
          gte(optOutRecords.createdAt, startDate),
          lte(optOutRecords.createdAt, endDate)
        )
      )
      .groupBy(optOutRecords.optOutReason);

    // Opt-out trend (daily for last 30 days)
    const optOutTrend = await db
      .select({
        date: sql<string>`DATE(${optOutRecords.optOutTimestamp})`,
        count: count(),
      })
      .from(optOutRecords)
      .where(
        and(
          eq(optOutRecords.clientId, clientId),
          gte(optOutRecords.optOutTimestamp, subDays(new Date(), 30))
        )
      )
      .groupBy(sql`DATE(${optOutRecords.optOutTimestamp})`)
      .orderBy(sql`DATE(${optOutRecords.optOutTimestamp})`);

    // Compliance events
    const events = await db
      .select({
        type: complianceAuditLog.eventType,
        count: count(),
      })
      .from(complianceAuditLog)
      .where(
        and(
          eq(complianceAuditLog.clientId, clientId),
          gte(complianceAuditLog.eventTimestamp, startDate),
          lte(complianceAuditLog.eventTimestamp, endDate)
        )
      )
      .groupBy(complianceAuditLog.eventType);

    // Calculate opt-out rate
    const optOutRate = totalConsents.count > 0
      ? (totalOptOuts.count / totalConsents.count) * 100
      : 0;

    // Generate risks and recommendations
    const risks: string[] = [];
    const recommendations: string[] = [];

    // Check for high opt-out rate
    if (optOutRate > 5) {
      risks.push(`High opt-out rate: ${optOutRate.toFixed(1)}%`);
      recommendations.push('Review message frequency and content. Consider A/B testing different approaches.');
    }

    // Check for implied consent dominance
    const impliedConsents = consentByType.find(c => c.type === 'implied')?.count || 0;
    if (impliedConsents > totalConsents.count * 0.3) {
      risks.push('Over 30% of consents are implied only');
      recommendations.push('Implement clear opt-in forms to capture express written consent.');
    }

    // Check for complaint-based opt-outs
    const complaints = optOutByReason.find(o => o.reason === 'complaint')?.count || 0;
    if (complaints > 0) {
      risks.push(`${complaints} complaint-based opt-outs recorded`);
      recommendations.push('Review complaint causes immediately. Consider reducing message frequency.');
    }

    // Check for old consents
    // (Would need additional query for consent age analysis)

    return {
      generatedAt: new Date(),
      period: {
        start: startDate,
        end: endDate,
      },
      summary: {
        totalConsents: totalConsents.count,
        activeConsents: activeConsents.count,
        totalOptOuts: totalOptOuts.count,
        optOutRate,
        dncListSize: dncSize.count,
        messagesBlocked: blockedMessages.count,
      },
      consentBreakdown: {
        byType: Object.fromEntries(consentByType.map(c => [c.type, c.count])),
        bySource: Object.fromEntries(consentBySource.map(c => [c.source, c.count])),
      },
      optOutBreakdown: {
        byReason: Object.fromEntries(optOutByReason.map(o => [o.reason, o.count])),
        trend: optOutTrend.map(t => ({ date: t.date, count: t.count })),
      },
      complianceEvents: events.map(e => ({ type: e.type, count: e.count })),
      risks,
      recommendations,
    };
  }

  /**
   * Generate PDF compliance report
   */
  static async generatePdfReport(
    clientId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Buffer> {
    const report = await this.generateReport(clientId, startDate, endDate);
    
    // Use a PDF library like pdf-lib or puppeteer to generate
    // For now, return placeholder
    const PDFDocument = (await import('pdfkit')).default;
    
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument();

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Header
      doc.fontSize(24).text('TCPA Compliance Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Period: ${format(report.period.start, 'MMM d, yyyy')} - ${format(report.period.end, 'MMM d, yyyy')}`);
      doc.text(`Generated: ${format(report.generatedAt, 'MMM d, yyyy h:mm a')}`);
      doc.moveDown(2);

      // Summary
      doc.fontSize(16).text('Summary');
      doc.fontSize(12);
      doc.text(`Total Consents: ${report.summary.totalConsents}`);
      doc.text(`Active Consents: ${report.summary.activeConsents}`);
      doc.text(`Total Opt-Outs: ${report.summary.totalOptOuts}`);
      doc.text(`Opt-Out Rate: ${report.summary.optOutRate.toFixed(2)}%`);
      doc.text(`DNC List Size: ${report.summary.dncListSize}`);
      doc.text(`Messages Blocked: ${report.summary.messagesBlocked}`);
      doc.moveDown(2);

      // Risks
      if (report.risks.length > 0) {
        doc.fontSize(16).fillColor('red').text('Risks');
        doc.fontSize(12).fillColor('black');
        report.risks.forEach(risk => doc.text(`• ${risk}`));
        doc.moveDown();
      }

      // Recommendations
      if (report.recommendations.length > 0) {
        doc.fontSize(16).text('Recommendations');
        doc.fontSize(12);
        report.recommendations.forEach(rec => doc.text(`• ${rec}`));
      }

      doc.end();
    });
  }
}
```

## API Routes

### File: `src/app/api/compliance/check/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getClientSession } from '@/lib/auth/client-session';
import { ComplianceService } from '@/lib/compliance/compliance-service';

export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { phoneNumber, messageType, recipientTimezone } = await req.json();

  if (!phoneNumber) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
  }

  const result = await ComplianceService.checkCompliance(
    session.clientId,
    phoneNumber,
    messageType || 'marketing',
    recipientTimezone
  );

  return NextResponse.json(result);
}
```

### File: `src/app/api/compliance/consent/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getClientSession } from '@/lib/auth/client-session';
import { ComplianceService } from '@/lib/compliance/compliance-service';

export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { phoneNumber, ...consent } = body;

  if (!phoneNumber || !consent.type || !consent.source || !consent.language) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
```

### File: `src/app/api/compliance/report/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getClientSession } from '@/lib/auth/client-session';
import { ComplianceReportGenerator } from '@/lib/compliance/report-generator';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'json';
  const months = parseInt(searchParams.get('months') || '1');

  const endDate = endOfMonth(new Date());
  const startDate = startOfMonth(subMonths(new Date(), months - 1));

  if (format === 'pdf') {
    const pdfBuffer = await ComplianceReportGenerator.generatePdfReport(
      session.clientId,
      startDate,
      endDate
    );

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="compliance-report-${startDate.toISOString().slice(0, 7)}.pdf"`,
      },
    });
  }

  const report = await ComplianceReportGenerator.generateReport(
    session.clientId,
    startDate,
    endDate
  );

  return NextResponse.json(report);
}
```

## UI Components

### File: `src/components/compliance/ConsentCapture.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConsentCaptureProps {
  phoneNumber: string;
  businessName: string;
  onConsent: (consent: {
    scope: {
      marketing: boolean;
      transactional: boolean;
      promotional: boolean;
      reminders: boolean;
    };
  }) => Promise<void>;
}

export function ConsentCapture({ phoneNumber, businessName, onConsent }: ConsentCaptureProps) {
  const [marketing, setMarketing] = useState(true);
  const [transactional, setTransactional] = useState(true);
  const [promotional, setPromotional] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onConsent({
        scope: { marketing, transactional, promotional, reminders },
      });
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Alert>
        <AlertDescription>
          Thank you! Your communication preferences have been saved.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Communication Preferences</CardTitle>
        <CardDescription>
          Select how you'd like to receive messages from {businessName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Phone number: {phoneNumber}
        </p>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="marketing"
              checked={marketing}
              onCheckedChange={(checked) => setMarketing(!!checked)}
            />
            <Label htmlFor="marketing">
              Marketing messages (promotions, offers)
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="transactional"
              checked={transactional}
              onCheckedChange={(checked) => setTransactional(!!checked)}
            />
            <Label htmlFor="transactional">
              Transactional messages (order updates, confirmations)
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="promotional"
              checked={promotional}
              onCheckedChange={(checked) => setPromotional(!!checked)}
            />
            <Label htmlFor="promotional">
              Special offers and discounts
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="reminders"
              checked={reminders}
              onCheckedChange={(checked) => setReminders(!!checked)}
            />
            <Label htmlFor="reminders">
              Appointment reminders
            </Label>
          </div>
        </div>

        <div className="text-xs text-muted-foreground p-3 bg-muted rounded-md">
          By clicking "Save Preferences", you consent to receive automated text messages
          from {businessName} at the phone number provided. Message and data rates may apply.
          Message frequency varies. Reply STOP to unsubscribe at any time.
        </div>

        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Saving...' : 'Save Preferences'}
        </Button>
      </CardContent>
    </Card>
  );
}
```

### File: `src/components/compliance/ComplianceDashboard.tsx`

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, AlertTriangle, CheckCircle, Shield } from 'lucide-react';

interface ComplianceDashboardProps {
  stats: {
    activeConsents: number;
    totalOptOuts: number;
    optOutRate: number;
    dncListSize: number;
    messagesBlocked: number;
    complianceScore: number;
  };
  risks: string[];
  onDownloadReport: () => void;
}

export function ComplianceDashboard({
  stats,
  risks,
  onDownloadReport,
}: ComplianceDashboardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: 'bg-green-100 text-green-800' };
    if (score >= 70) return { label: 'Good', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Needs Attention', color: 'bg-red-100 text-red-800' };
  };

  const scoreBadge = getScoreBadge(stats.complianceScore);

  return (
    <div className="space-y-6">
      {/* Compliance Score */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            TCPA Compliance Score
          </CardTitle>
          <Badge className={scoreBadge.color}>{scoreBadge.label}</Badge>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className={`text-4xl font-bold ${getScoreColor(stats.complianceScore)}`}>
              {stats.complianceScore}%
            </div>
            <Progress value={stats.complianceScore} className="flex-1 h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Consents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeConsents.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Opt-Outs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOptOuts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.optOutRate.toFixed(1)}% rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">DNC List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.dncListSize.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Messages Blocked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.messagesBlocked.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Risks */}
      {risks.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              Compliance Risks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {risks.map((risk, idx) => (
                <li key={idx} className="flex items-start gap-2 text-amber-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {risk}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Download Report */}
      <div className="flex justify-end">
        <Button onClick={onDownloadReport}>
          <Download className="mr-2 h-4 w-4" />
          Download Compliance Report
        </Button>
      </div>
    </div>
  );
}
```

## Testing Checklist

```markdown
## TCPA Compliance Testing

### Opt-Out Handling
- [ ] STOP keyword triggers opt-out
- [ ] STOPALL keyword triggers opt-out
- [ ] Case-insensitive opt-out detection
- [ ] Opt-out confirmation message sent
- [ ] Lead status updated to opted_out
- [ ] Consent record marked inactive
- [ ] Cache invalidated after opt-out
- [ ] Future messages blocked

### Opt-In Handling
- [ ] START keyword triggers re-opt-in
- [ ] New consent record created
- [ ] Previous opt-out marked as re-opted
- [ ] Lead status updated to active
- [ ] Opt-in confirmation message sent

### Consent Recording
- [ ] Web form consent captured with IP/UA
- [ ] Text opt-in consent recorded
- [ ] Consent scope properly stored
- [ ] Consent language captured
- [ ] Consent timestamp accurate

### DNC List
- [ ] Single number addition works
- [ ] Bulk import processes correctly
- [ ] Duplicate detection works
- [ ] Global vs client-specific DNC
- [ ] DNC expiration honored
- [ ] Messages blocked for DNC numbers

### Quiet Hours
- [ ] Default quiet hours enforced (9 PM - 8 AM)
- [ ] Weekend hours work if configured
- [ ] Timezone conversion accurate
- [ ] Holiday detection works
- [ ] Queue option works during quiet hours

### Compliance Check
- [ ] Full check validates all conditions
- [ ] Cache improves performance
- [ ] Cache invalidation works
- [ ] Warnings generated appropriately
- [ ] Audit log entries created

### Reporting
- [ ] JSON report generates correctly
- [ ] PDF report generates correctly
- [ ] Metrics calculated accurately
- [ ] Risk detection works
- [ ] Recommendations generated

### Edge Cases
- [ ] Invalid phone numbers handled
- [ ] Missing consent handled gracefully
- [ ] Multiple consents for same number
- [ ] Re-opt-in after DNC
- [ ] Concurrent opt-out requests
```

## Implementation Notes

1. **Phone Number Hashing**: All phone numbers are hashed before storage for privacy. Original numbers stored only where legally required.

2. **Consent Language**: Always store the exact text shown to users. This is critical evidence in disputes.

3. **Audit Trail**: Every compliance-related action is logged. Logs are immutable and retained for 5+ years.

4. **Quiet Hours**: Default to Eastern Time if recipient timezone unknown. Always err on the side of not sending.

5. **DNC Updates**: National DNC registry should be synced monthly. State registries may have different requirements.

6. **Retention**: Consent records must be kept for at least 4 years after last message sent.

7. **Legal Review**: This implementation should be reviewed by legal counsel familiar with TCPA regulations.
