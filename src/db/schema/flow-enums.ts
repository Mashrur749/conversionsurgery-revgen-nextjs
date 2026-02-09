import { pgEnum } from 'drizzle-orm/pg-core';

export const flowCategoryEnum = pgEnum('flow_category', [
  'missed_call',
  'form_response',
  'estimate',
  'appointment',
  'payment',
  'review',
  'referral',
  'custom',
]);

export const flowTriggerEnum = pgEnum('flow_trigger', [
  'webhook',
  'scheduled',
  'manual',
  'ai_suggested',
]);

export const flowApprovalEnum = pgEnum('flow_approval', [
  'auto',
  'suggest',
  'ask_sms',
]);

export const flowSyncModeEnum = pgEnum('flow_sync_mode', [
  'inherit',
  'override',
  'detached',
]);
