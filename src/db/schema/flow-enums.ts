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
export type FlowCategory = (typeof flowCategoryEnum.enumValues)[number];

export const flowTriggerEnum = pgEnum('flow_trigger', [
  'webhook',
  'scheduled',
  'manual',
  'ai_suggested',
]);
export type FlowTrigger = (typeof flowTriggerEnum.enumValues)[number];

export const flowApprovalEnum = pgEnum('flow_approval', [
  'auto',
  'suggest',
  'ask_sms',
]);
export type FlowApproval = (typeof flowApprovalEnum.enumValues)[number];

export const flowSyncModeEnum = pgEnum('flow_sync_mode', [
  'inherit',
  'override',
  'detached',
]);
export type FlowSyncMode = (typeof flowSyncModeEnum.enumValues)[number];
