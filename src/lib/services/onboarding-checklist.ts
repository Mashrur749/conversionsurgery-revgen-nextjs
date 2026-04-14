/**
 * Onboarding Checklist Service
 *
 * Evaluates 10 platform-enforced onboarding items per client.
 * Some items block capabilities (Smart Assist, Autonomous mode);
 * others are advisory only.
 *
 * All DB queries run in parallel via Promise.all.
 */
import { getDb } from '@/db';
import {
  clients,
  clientPhoneNumbers,
  clientMemberships,
  people,
  knowledgeBase,
  clientServices,
  subscriptions,
  auditLog,
  revenueLeakAudits,
} from '@/db/schema';
import { and, count, eq, inArray, isNotNull } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChecklistItem {
  key: string;
  label: string;
  completed: boolean;
  blocking: string | null; // capability name that is blocked, or null if advisory
  description: string;
}

export interface OnboardingChecklistResult {
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  blockedCapabilities: string[]; // unique list of blocked capabilities from incomplete blocking items
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function forwardingDescription(status: string | null): string {
  if (status === 'passed') return 'Call forwarding has been verified successfully.';
  if (status === 'failed') return 'Call forwarding verification failed — please retry.';
  return 'Pending phone setup — forwarding verification not yet run.';
}

function voicemailDescription(status: string | null): string {
  if (status === 'passed') return 'Voicemail is disabled (confirmed via forwarding test).';
  if (status === 'failed') return 'Voicemail may still be active — forwarding test failed.';
  return 'Pending phone setup — voicemail status not yet confirmed.';
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function getOnboardingChecklist(
  clientId: string
): Promise<OnboardingChecklistResult> {
  const db = getDb();

  // Run all queries in parallel
  const [
    clientRow,
    phoneRow,
    escalationMemberRow,
    kbCount,
    pricingServiceRow,
    subscriptionRow,
    quoteImportCount,
    rlaRow,
  ] = await Promise.all([
    // Item 3, 4, 7 — fetch client row once
    db
      .select({
        forwardingVerificationStatus: clients.forwardingVerificationStatus,
        exclusionListReviewed: clients.exclusionListReviewed,
      })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1),

    // Item 1 — phone_assigned
    db
      .select({ id: clientPhoneNumbers.id })
      .from(clientPhoneNumbers)
      .where(
        and(
          eq(clientPhoneNumbers.clientId, clientId),
          eq(clientPhoneNumbers.isPrimary, true),
          eq(clientPhoneNumbers.isActive, true)
        )
      )
      .limit(1),

    // Item 2 — operator_phone: active member with receiveEscalations=true AND non-null phone
    db
      .select({ id: clientMemberships.id })
      .from(clientMemberships)
      .innerJoin(people, eq(clientMemberships.personId, people.id))
      .where(
        and(
          eq(clientMemberships.clientId, clientId),
          eq(clientMemberships.isActive, true),
          eq(clientMemberships.receiveEscalations, true),
          isNotNull(people.phone)
        )
      )
      .limit(1),

    // Item 5 — kb_minimum: count KB entries for this client
    db
      .select({ value: count() })
      .from(knowledgeBase)
      .where(eq(knowledgeBase.clientId, clientId)),

    // Item 6 — pricing_set: active services with yes_range — check price ranges in JS
    db
      .select({
        id: clientServices.id,
        priceRangeMinCents: clientServices.priceRangeMinCents,
        priceRangeMaxCents: clientServices.priceRangeMaxCents,
      })
      .from(clientServices)
      .where(
        and(
          eq(clientServices.clientId, clientId),
          eq(clientServices.isActive, true),
          eq(clientServices.canDiscussPrice, 'yes_range')
        )
      ),

    // Item 8 — payment_captured: subscription with qualifying status
    db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.clientId, clientId),
          inArray(subscriptions.status, ['active', 'trialing', 'past_due'])
        )
      )
      .limit(1),

    // Item 9 — quote_import: audit_log entry with action = 'quote_import_completed'
    db
      .select({ value: count() })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.clientId, clientId),
          eq(auditLog.action, 'quote_import_completed')
        )
      ),

    // Item 10 — rla_sent: revenueLeakAudits row exists for this client
    db
      .select({ id: revenueLeakAudits.id })
      .from(revenueLeakAudits)
      .where(eq(revenueLeakAudits.clientId, clientId))
      .limit(1),
  ]);

  const client = clientRow[0];
  const forwardingStatus = client?.forwardingVerificationStatus ?? null;
  const exclusionListReviewed = client?.exclusionListReviewed ?? false;

  const kbEntryCount = kbCount[0]?.value ?? 0;
  const quoteImports = quoteImportCount[0]?.value ?? 0;

  // Validate pricing service also has valid price ranges (checked in JS — small row set)
  const pricingValid = pricingServiceRow.some(
    (s) =>
      s.priceRangeMinCents !== null &&
      s.priceRangeMinCents > 0 &&
      s.priceRangeMaxCents !== null &&
      s.priceRangeMaxCents > 0
  );

  // ---------------------------------------------------------------------------
  // Build checklist items
  // ---------------------------------------------------------------------------

  const items: ChecklistItem[] = [
    {
      key: 'phone_assigned',
      label: 'Phone number assigned',
      completed: phoneRow.length > 0,
      blocking: null,
      description:
        phoneRow.length > 0
          ? 'An active primary phone number is assigned to this client.'
          : 'No active primary phone number assigned — assign a Twilio number to enable SMS.',
    },
    {
      key: 'operator_phone',
      label: 'Operator phone configured',
      completed: escalationMemberRow.length > 0,
      blocking: 'Smart Assist',
      description:
        escalationMemberRow.length > 0
          ? 'At least one active team member with escalation routing and a phone number is configured.'
          : 'No team member with escalation enabled and a phone number — add one to enable Smart Assist.',
    },
    {
      key: 'forwarding_tested',
      label: 'Call forwarding verified',
      completed: forwardingStatus === 'passed',
      blocking: 'Smart Assist',
      description: forwardingDescription(forwardingStatus),
    },
    {
      key: 'voicemail_disabled',
      label: 'Voicemail disabled',
      completed: forwardingStatus === 'passed',
      blocking: 'Smart Assist',
      description: voicemailDescription(forwardingStatus),
    },
    {
      key: 'kb_minimum',
      label: 'KB entries >= 5',
      completed: kbEntryCount >= 5,
      blocking: 'Smart Assist',
      description:
        kbEntryCount >= 5
          ? `Knowledge base has ${kbEntryCount} entries — minimum met.`
          : `Knowledge base has ${kbEntryCount} entr${kbEntryCount === 1 ? 'y' : 'ies'} — add at least ${5 - kbEntryCount} more to enable Smart Assist.`,
    },
    {
      key: 'pricing_set',
      label: 'Pricing range configured',
      completed: pricingValid,
      blocking: 'Autonomous mode',
      description: pricingValid
        ? 'At least one service has a valid price range configured for AI disclosure.'
        : 'No service has a valid price range — configure at least one service with a min/max price range to enable Autonomous mode.',
    },
    {
      key: 'exclusion_reviewed',
      label: 'Exclusion list reviewed',
      completed: exclusionListReviewed,
      blocking: 'Autonomous mode',
      description: exclusionListReviewed
        ? 'Exclusion list has been reviewed and acknowledged.'
        : 'Exclusion list has not been reviewed — an operator must review and acknowledge the list to enable Autonomous mode.',
    },
    {
      key: 'payment_captured',
      label: 'Payment captured',
      completed: subscriptionRow.length > 0,
      blocking: null,
      description:
        subscriptionRow.length > 0
          ? 'Client has an active subscription.'
          : 'No active subscription found — capture payment to complete billing setup.',
    },
    {
      key: 'quote_import',
      label: 'Quote import completed',
      completed: quoteImports > 0,
      blocking: null,
      description:
        quoteImports > 0
          ? 'Historical quote data has been imported.'
          : 'No quote import recorded — import historical quotes to improve lead scoring.',
    },
    {
      key: 'rla_sent',
      label: 'Revenue Leak Audit sent',
      completed: rlaRow.length > 0,
      blocking: null,
      description:
        rlaRow.length > 0
          ? 'Revenue Leak Audit has been created and delivered.'
          : 'No Revenue Leak Audit on file — create and deliver the audit to complete onboarding.',
    },
  ];

  // ---------------------------------------------------------------------------
  // Aggregate results
  // ---------------------------------------------------------------------------

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;

  const blockedCapabilities = [
    ...new Set(
      items
        .filter((i) => !i.completed && i.blocking !== null)
        .map((i) => i.blocking as string)
    ),
  ];

  return {
    items,
    completedCount,
    totalCount,
    blockedCapabilities,
  };
}
