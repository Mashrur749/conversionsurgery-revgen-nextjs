import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { leads } from './leads';

/** Allowed consent types for TCPA compliance */
export const consentTypeEnum = pgEnum('consent_type', [
  'express_written',
  'express_oral',
  'implied',
  'transactional',
]);

/** Source channel through which consent was obtained */
export const consentSourceEnum = pgEnum('consent_source', [
  'web_form',
  'text_optin',
  'paper_form',
  'phone_recording',
  'existing_customer',
  'manual_entry',
  'api_import',
]);

/** Reason a contact opted out of communications */
export const optOutReasonEnum = pgEnum('opt_out_reason', [
  'stop_keyword',
  'unsubscribe_link',
  'manual_request',
  'complaint',
  'admin_removed',
  'dnc_match',
  'bounce',
]);

// ============================================
// CONSENT RECORDS
// ============================================
/** Stores explicit consent records for TCPA compliance tracking */
export const consentRecords = pgTable(
  'consent_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    leadId: uuid('lead_id').references(() => leads.id),

    // Contact info
    phoneNumber: text('phone_number').notNull(),
    phoneNumberHash: text('phone_number_hash').notNull(),

    // Consent details
    consentType: consentTypeEnum('consent_type').notNull(),
    consentSource: consentSourceEnum('consent_source').notNull(),

    // What they consented to
    consentScope: jsonb('consent_scope')
      .$type<{
        marketing: boolean;
        transactional: boolean;
        promotional: boolean;
        reminders: boolean;
      }>()
      .notNull(),

    // Consent language shown
    consentLanguage: text('consent_language').notNull(),

    // Evidence
    consentTimestamp: timestamp('consent_timestamp').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    formUrl: text('form_url'),
    signatureImage: text('signature_image'),
    recordingUrl: text('recording_url'),

    // Status
    isActive: boolean('is_active').notNull().default(true),
    revokedAt: timestamp('revoked_at'),
    revokedReason: text('revoked_reason'),

    // Metadata
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_consent_client_phone').on(table.clientId, table.phoneNumber),
    index('idx_consent_phone_hash').on(table.phoneNumberHash),
    index('idx_consent_lead').on(table.leadId),
    index('idx_consent_active').on(table.clientId, table.isActive),
  ]
);

// ============================================
// OPT-OUT RECORDS
// ============================================
/** Tracks when contacts opt out of communications */
export const optOutRecords = pgTable(
  'opt_out_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    leadId: uuid('lead_id').references(() => leads.id),

    // Contact info
    phoneNumber: text('phone_number').notNull(),
    phoneNumberHash: text('phone_number_hash').notNull(),

    // Opt-out details
    optOutReason: optOutReasonEnum('opt_out_reason').notNull(),
    optOutTimestamp: timestamp('opt_out_timestamp').notNull().defaultNow(),

    // Evidence
    triggerMessage: text('trigger_message'),
    triggerMessageId: uuid('trigger_message_id'),

    // Processing
    processedAt: timestamp('processed_at'),
    processedBy: text('processed_by'),

    // Re-opt-in tracking
    reoptedInAt: timestamp('reopted_in_at'),
    reoptinConsentId: uuid('reoptin_consent_id').references(
      () => consentRecords.id
    ),

    // Metadata
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_optout_client_phone').on(table.clientId, table.phoneNumber),
    index('idx_optout_phone_hash').on(table.phoneNumberHash),
    index('idx_optout_timestamp').on(table.optOutTimestamp),
  ]
);

// ============================================
// DO NOT CONTACT LIST
// ============================================
/** Global and per-client do-not-contact registry */
export const doNotContactList = pgTable(
  'do_not_contact_list',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Scope: null = global, clientId = client-specific
    clientId: uuid('client_id').references(() => clients.id),

    // Contact info
    phoneNumber: text('phone_number').notNull(),
    phoneNumberHash: text('phone_number_hash').notNull(),

    // Source
    source: text('source').notNull(),
    sourceReference: text('source_reference'),

    // Validity
    addedAt: timestamp('added_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'),

    // Status
    isActive: boolean('is_active').notNull().default(true),
    removedAt: timestamp('removed_at'),
    removeReason: text('remove_reason'),

    // Metadata
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('idx_dnc_phone_hash').on(table.phoneNumberHash),
    index('idx_dnc_client_phone').on(table.clientId, table.phoneNumber),
    index('idx_dnc_source').on(table.source),
    index('idx_dnc_active').on(table.isActive),
  ]
);

// ============================================
// QUIET HOURS CONFIGURATION
// ============================================
/** Per-client quiet hours settings to prevent sending during off-hours */
export const quietHoursConfig = pgTable('quiet_hours_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id)
    .unique(),

  // Standard quiet hours (recipient's local time)
  quietStartHour: integer('quiet_start_hour').notNull().default(21),
  quietEndHour: integer('quiet_end_hour').notNull().default(10), // CRTC requires 9:30am, we use 10am for safety

  // Day-specific overrides (0 = Sunday, 6 = Saturday)
  weekendQuietStartHour: integer('weekend_quiet_start_hour'),
  weekendQuietEndHour: integer('weekend_quiet_end_hour'),

  // Holiday handling
  respectFederalHolidays: boolean('respect_federal_holidays').notNull().default(true),
  holidayQuietAllDay: boolean('holiday_quiet_all_day').notNull().default(false),

  // Enforcement
  enforceQuietHours: boolean('enforce_quiet_hours').notNull().default(true),
  queueDuringQuietHours: boolean('queue_during_quiet_hours').notNull().default(true),

  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// COMPLIANCE AUDIT LOG
// ============================================
/** Immutable audit trail of all compliance-related events */
export const complianceAuditLog = pgTable(
  'compliance_audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id').references(() => clients.id),

    // Event details
    eventType: text('event_type').notNull(),
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
    actorType: text('actor_type').notNull(),
    actorId: text('actor_id'),

    // Result
    success: boolean('success').notNull(),
    errorMessage: text('error_message'),

    // Metadata
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
  },
  (table) => [
    index('idx_audit_client_event').on(table.clientId, table.eventType),
    index('idx_audit_timestamp').on(table.eventTimestamp),
    index('idx_audit_phone_hash').on(table.phoneNumberHash),
  ]
);

// ============================================
// MESSAGE COMPLIANCE CHECK CACHE
// ============================================
/** Cached compliance check results to avoid repeated lookups */
export const complianceCheckCache = pgTable(
  'compliance_check_cache',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
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
  },
  (table) => [
    index('idx_cache_client_phone').on(table.clientId, table.phoneNumber),
    index('idx_cache_expires').on(table.expiresAt),
  ]
);

// Type exports
export type ConsentRecord = typeof consentRecords.$inferSelect;
export type NewConsentRecord = typeof consentRecords.$inferInsert;
export type OptOutRecord = typeof optOutRecords.$inferSelect;
export type NewOptOutRecord = typeof optOutRecords.$inferInsert;
export type DoNotContactEntry = typeof doNotContactList.$inferSelect;
export type QuietHoursConfigType = typeof quietHoursConfig.$inferSelect;
export type ComplianceAuditEntry = typeof complianceAuditLog.$inferSelect;
export type ComplianceCacheEntry = typeof complianceCheckCache.$inferSelect;
