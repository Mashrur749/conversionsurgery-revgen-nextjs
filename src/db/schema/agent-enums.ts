import { pgEnum } from 'drizzle-orm/pg-core';

// ============================================
// CONVERSATION AGENT ENUMS
// ============================================

export const leadStageEnum = pgEnum('lead_stage', [
  'new',           // Just came in, no conversation yet
  'qualifying',    // Gathering info about their needs
  'nurturing',     // Not ready yet, staying in touch
  'hot',           // Showing buying signals
  'objection',     // Has concerns/objections to address
  'escalated',     // Needs human intervention
  'booked',        // Appointment/job scheduled
  'lost',          // Unsubscribed, went competitor, no response
]);

export const sentimentEnum = pgEnum('sentiment', [
  'positive',
  'neutral',
  'negative',
  'frustrated',
]);

export const escalationReasonEnum = pgEnum('escalation_reason', [
  'explicit_request',       // Asked for human/manager/owner
  'frustrated_sentiment',   // Detected frustration
  'legal_threat',           // Mentioned lawyer, BBB, complaint
  'repeated_objection',     // Same objection 3+ times
  'complex_technical',      // Question beyond AI capability
  'high_value_lead',        // Big job, needs personal touch
  'negative_review_threat', // Threatened bad review
  'pricing_negotiation',    // Wants custom pricing
  'complaint',              // Service complaint
  'emergency',              // Urgent safety/emergency issue
  'other',
]);

export const agentActionEnum = pgEnum('agent_action', [
  'respond',          // Send AI response
  'wait',             // Don't respond yet, let them reply
  'trigger_flow',     // Start an automated flow
  'escalate',         // Hand off to human
  'book_appointment', // Attempt booking
  'send_quote',       // Send estimate/quote
  'request_photos',   // Ask for project photos
  'send_payment',     // Send payment link
  'close_won',        // Mark as booked/won
  'close_lost',       // Mark as lost
]);
