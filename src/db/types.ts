/**
 * TypeScript type exports from database schema
 * These types are inferred from the Drizzle schema and are fully type-safe
 */

// Clients
export type { Client, NewClient } from './schema/clients';

// Leads
export type { Lead, NewLead } from './schema/leads';

// Conversations
export type { Conversation, NewConversation } from './schema/conversations';

// Scheduled Messages
export type { ScheduledMessage, NewScheduledMessage } from './schema/scheduled-messages';

// Appointments
export type { Appointment, NewAppointment } from './schema/appointments';

// Invoices
export type { Invoice, NewInvoice } from './schema/invoices';

// Blocked Numbers
export type { BlockedNumber, NewBlockedNumber } from './schema/blocked-numbers';

// Error Log
export type { ErrorLog, NewErrorLog } from './schema/error-log';

// Webhook Log
export type { WebhookLog, NewWebhookLog } from './schema/webhook-log';

// Message Templates
export type { MessageTemplate, NewMessageTemplate } from './schema/message-templates';

// Daily Stats
export type { DailyStats, NewDailyStats } from './schema/daily-stats';

// Flow Templates
export type {
  FlowTemplate,
  NewFlowTemplate,
  FlowTemplateStep,
  NewFlowTemplateStep,
  FlowTemplateVersion,
  NewFlowTemplateVersion,
} from './schema/flow-templates';

// Flows
export type { Flow, NewFlow, FlowStep, NewFlowStep } from './schema/flows';

// Flow Executions
export type {
  FlowExecution,
  NewFlowExecution,
  FlowStepExecution,
  NewFlowStepExecution,
  SuggestedAction,
  NewSuggestedAction,
} from './schema/flow-executions';

// Billing & Subscriptions
export type { Plan, NewPlan } from './schema/plans';
export type { Subscription, NewSubscription } from './schema/subscriptions';
export type { BillingPaymentMethod, NewBillingPaymentMethod } from './schema/billing-payment-methods';
export type { SubscriptionInvoice, NewSubscriptionInvoice } from './schema/subscription-invoices';
export type { UsageRecord, NewUsageRecord } from './schema/usage-records';
export type { BillingEvent, NewBillingEvent } from './schema/billing-events';
export type { Coupon, NewCoupon } from './schema/coupons';
