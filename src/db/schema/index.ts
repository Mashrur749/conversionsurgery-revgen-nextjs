// Export all schemas
export * from './clients';
export * from './leads';
export * from './conversations';
export * from './scheduled-messages';
export * from './appointments';
export * from './invoices';
export * from './blocked-numbers';
export * from './error-log';
export * from './webhook-log';
export * from './message-templates';
export * from './daily-stats';
export * from './active-calls';
export * from './team-members';
export * from './escalation-claims';
export * from './business-hours';
export * from './call-attempts';
export * from './ab-tests';
export * from './reports';
export * from './template-variants';
export * from './template-performance-metrics';
export * from './api-usage';
export * from './api-usage-daily';
export * from './api-usage-monthly';
export * from './usage-alerts';
export * from './magic-link-tokens';
export * from './otp-codes';
export * from './flow-enums';
export * from './flow-templates';
export * from './flows';
export * from './flow-executions';
export * from './template-metrics-daily';
export * from './template-step-metrics';
export * from './client-flow-outcomes';
export * from './knowledge-base';
export * from './knowledge-gaps';
export * from './notification-preferences';
export * from './cancellation-requests';
export * from './client-services';
export * from './jobs';
export * from './revenue-events';
export * from './media-attachments';
export * from './payments';
export * from './payment-reminders';
export * from './reviews';
export * from './review-sources';
export * from './review-metrics';
export * from './response-templates';
export * from './review-responses';
export * from './calendar-integrations';
export * from './calendar-events';
export * from './voice-calls';
export * from './subscription-plans';
export * from './admin-users';
export * from './system-settings';
export * from './agency-messages';

export * from './compliance';

// Conversation Agent
export * from './agent-enums';
export * from './lead-context';
export * from './agent-decisions';
export * from './escalation-queue';
export * from './escalation-rules';
export * from './conversation-checkpoints';
export * from './client-agent-settings';

// Billing & Subscriptions
export * from './billing-enums';
export * from './plans';
export * from './subscriptions';
export * from './billing-payment-methods';
export * from './subscription-invoices';
export * from './usage-records';
export * from './billing-events';
export * from './coupons';

// Analytics
export * from './analytics-daily';
export * from './analytics-weekly';
export * from './analytics-monthly';
export * from './platform-analytics';
export * from './funnel-events';
export * from './client-cohorts';

// Support
export * from './support-messages';
export * from './support-replies';

// Help & Surveys
export * from './help-articles';
export * from './nps-surveys';

// Email Templates & API Keys
export * from './email-templates';
export * from './api-keys';

// Multi-number support
export * from './client-phone-numbers';

// Auth tables (NextAuth)
export * from './auth';

// Export all relations for type-safe queries
export * from './relations';
