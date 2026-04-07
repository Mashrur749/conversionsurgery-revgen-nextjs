import { relations } from 'drizzle-orm';
import { clients } from './clients';
import { users, accounts, sessions } from './auth';
import { leads } from './leads';
import { conversations } from './conversations';
import { scheduledMessages } from './scheduled-messages';
import { appointments } from './appointments';
import { invoices } from './invoices';
import { blockedNumbers } from './blocked-numbers';
import { messageTemplates } from './message-templates';
import { dailyStats } from './daily-stats';
import { escalationClaims } from './escalation-claims';
import { businessHours } from './business-hours';
import { callAttempts } from './call-attempts';
import { magicLinkTokens } from './magic-link-tokens';
import { reports } from './reports';
import { reportDeliveries, reportDeliveryEvents } from './report-deliveries';
import { flowTemplates, flowTemplateSteps, flowTemplateVersions } from './flow-templates';
import { flows, flowSteps } from './flows';
import { flowExecutions, flowStepExecutions, suggestedActions } from './flow-executions';
import { knowledgeBase } from './knowledge-base';
import { notificationPreferences } from './notification-preferences';
import { cancellationRequests } from './cancellation-requests';
import { dataExportRequests } from './data-export-requests';
import {
  onboardingMilestones,
  onboardingMilestoneActivities,
  onboardingSlaAlerts,
  revenueLeakAudits,
} from './onboarding-day-one';
import { clientServices } from './client-services';
import { jobs } from './jobs';
import { revenueEvents } from './revenue-events';
import { mediaAttachments } from './media-attachments';
import { payments } from './payments';
import { paymentReminders } from './payment-reminders';
import { consentRecords, optOutRecords } from './compliance';
import { leadContext } from './lead-context';
import { agentDecisions } from './agent-decisions';
import { escalationQueue } from './escalation-queue';
import { escalationRules } from './escalation-rules';
import { conversationCheckpoints } from './conversation-checkpoints';
import { clientAgentSettings } from './client-agent-settings';
import { quarterlyCampaigns } from './quarterly-campaigns';
import { people } from './people';
import { roleTemplates } from './role-templates';
import { clientMemberships } from './client-memberships';
import { agencyMemberships } from './agency-memberships';
import { agencyClientAssignments } from './agency-client-assignments';
import { auditLog } from './audit-log';
import { errorLog } from './error-log';
import { webhookLog } from './webhook-log';
import { activeCalls } from './active-calls';
import { abTests, abTestMetrics } from './ab-tests';
import { templateVariants } from './template-variants';
import { templatePerformanceMetrics } from './template-performance-metrics';
import { apiUsage } from './api-usage';
import { apiUsageDaily } from './api-usage-daily';
import { apiUsageMonthly } from './api-usage-monthly';
import { usageAlerts } from './usage-alerts';
import { otpCodes } from './otp-codes';
import { templateMetricsDaily } from './template-metrics-daily';
import { templateStepMetrics } from './template-step-metrics';
import { clientFlowOutcomes } from './client-flow-outcomes';
import { knowledgeGaps } from './knowledge-gaps';
import { onboardingQualitySnapshots, onboardingQualityOverrides } from './onboarding-quality';
import { reviews } from './reviews';
import { reviewSources } from './review-sources';
import { reviewMetrics } from './review-metrics';
import { responseTemplates } from './response-templates';
import { reviewResponses } from './review-responses';
import { calendarIntegrations } from './calendar-integrations';
import { calendarEvents } from './calendar-events';
import { voiceCalls } from './voice-calls';
import { plans } from './plans';
import { subscriptions } from './subscriptions';
import { billingPaymentMethods } from './billing-payment-methods';
import { subscriptionInvoices } from './subscription-invoices';
import { usageRecords } from './usage-records';
import { billingEvents } from './billing-events';
import { addonBillingEvents } from './addon-billing-events';
import { analyticsDaily } from './analytics-daily';
import { analyticsWeekly } from './analytics-weekly';
import { analyticsMonthly } from './analytics-monthly';
import { funnelEvents } from './funnel-events';
import { clientCohorts } from './client-cohorts';
import { supportMessages } from './support-messages';
import { supportReplies } from './support-replies';
import { npsSurveys } from './nps-surveys';
import { apiKeys } from './api-keys';
import { clientPhoneNumbers } from './client-phone-numbers';
import { integrationWebhooks } from './integration-webhooks';
import { agencyMessages } from './agency-messages';

/**
 * Define relationships between tables for type-safe queries
 */

export const clientsRelations = relations(clients, ({ many }) => ({
  leads: many(leads),
  conversations: many(conversations),
  scheduledMessages: many(scheduledMessages),
  appointments: many(appointments),
  invoices: many(invoices),
  blockedNumbers: many(blockedNumbers),
  messageTemplates: many(messageTemplates),
  dailyStats: many(dailyStats),
  escalationClaims: many(escalationClaims),
  businessHours: many(businessHours),
  callAttempts: many(callAttempts),
  magicLinkTokens: many(magicLinkTokens),
  flows: many(flows),
  flowExecutions: many(flowExecutions),
  suggestedActions: many(suggestedActions),
  knowledgeBase: many(knowledgeBase),
  notificationPreferences: many(notificationPreferences),
  cancellationRequests: many(cancellationRequests),
  dataExportRequests: many(dataExportRequests),
  reportDeliveries: many(reportDeliveries),
  onboardingMilestones: many(onboardingMilestones),
  onboardingMilestoneActivities: many(onboardingMilestoneActivities),
  onboardingSlaAlerts: many(onboardingSlaAlerts),
  revenueLeakAudits: many(revenueLeakAudits),
  clientServices: many(clientServices),
  jobs: many(jobs),
  revenueEvents: many(revenueEvents),
  mediaAttachments: many(mediaAttachments),
  payments: many(payments),
  consentRecords: many(consentRecords),
  optOutRecords: many(optOutRecords),
  leadContexts: many(leadContext),
  agentDecisions: many(agentDecisions),
  escalationQueueItems: many(escalationQueue),
  escalationRules: many(escalationRules),
  clientAgentSettings: many(clientAgentSettings),
  clientMemberships: many(clientMemberships),
  agencyClientAssignments: many(agencyClientAssignments),
  auditLogEntries: many(auditLog),
  quarterlyCampaigns: many(quarterlyCampaigns),
}));

export const reportsRelations = relations(reports, ({ one, many }) => ({
  client: one(clients, {
    fields: [reports.clientId],
    references: [clients.id],
  }),
  deliveries: many(reportDeliveries),
}));

export const reportDeliveriesRelations = relations(
  reportDeliveries,
  ({ one, many }) => ({
    client: one(clients, {
      fields: [reportDeliveries.clientId],
      references: [clients.id],
    }),
    report: one(reports, {
      fields: [reportDeliveries.reportId],
      references: [reports.id],
    }),
    events: many(reportDeliveryEvents),
  })
);

export const reportDeliveryEventsRelations = relations(
  reportDeliveryEvents,
  ({ one }) => ({
    delivery: one(reportDeliveries, {
      fields: [reportDeliveryEvents.deliveryId],
      references: [reportDeliveries.id],
    }),
  })
);

export const cancellationRequestsRelations = relations(
  cancellationRequests,
  ({ one, many }) => ({
    client: one(clients, {
      fields: [cancellationRequests.clientId],
      references: [clients.id],
    }),
    dataExportRequests: many(dataExportRequests),
  })
);

export const dataExportRequestsRelations = relations(
  dataExportRequests,
  ({ one }) => ({
    client: one(clients, {
      fields: [dataExportRequests.clientId],
      references: [clients.id],
    }),
    cancellationRequest: one(cancellationRequests, {
      fields: [dataExportRequests.cancellationRequestId],
      references: [cancellationRequests.id],
    }),
  })
);

export const onboardingMilestonesRelations = relations(
  onboardingMilestones,
  ({ one, many }) => ({
    client: one(clients, {
      fields: [onboardingMilestones.clientId],
      references: [clients.id],
    }),
    activities: many(onboardingMilestoneActivities),
    alerts: many(onboardingSlaAlerts),
  })
);

export const onboardingMilestoneActivitiesRelations = relations(
  onboardingMilestoneActivities,
  ({ one }) => ({
    client: one(clients, {
      fields: [onboardingMilestoneActivities.clientId],
      references: [clients.id],
    }),
    milestone: one(onboardingMilestones, {
      fields: [onboardingMilestoneActivities.milestoneId],
      references: [onboardingMilestones.id],
    }),
  })
);

export const onboardingSlaAlertsRelations = relations(
  onboardingSlaAlerts,
  ({ one }) => ({
    client: one(clients, {
      fields: [onboardingSlaAlerts.clientId],
      references: [clients.id],
    }),
    milestone: one(onboardingMilestones, {
      fields: [onboardingSlaAlerts.milestoneId],
      references: [onboardingMilestones.id],
    }),
  })
);

export const revenueLeakAuditsRelations = relations(
  revenueLeakAudits,
  ({ one }) => ({
    client: one(clients, {
      fields: [revenueLeakAudits.clientId],
      references: [clients.id],
    }),
  })
);

export const usersRelations = relations(users, ({ one, many }) => ({
  person: one(people, { fields: [users.personId], references: [people.id] }),
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  client: one(clients, {
    fields: [leads.clientId],
    references: [clients.id],
  }),
  conversations: many(conversations),
  scheduledMessages: many(scheduledMessages),
  appointments: many(appointments),
  invoices: many(invoices),
  flowExecutions: many(flowExecutions),
  suggestedActions: many(suggestedActions),
  jobs: many(jobs),
  mediaAttachments: many(mediaAttachments),
  payments: many(payments),
  leadContext: many(leadContext),
  agentDecisions: many(agentDecisions),
  escalationQueueItems: many(escalationQueue),
  conversationCheckpoints: many(conversationCheckpoints),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  lead: one(leads, {
    fields: [conversations.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [conversations.clientId],
    references: [clients.id],
  }),
  mediaAttachments: many(mediaAttachments),
}));

export const scheduledMessagesRelations = relations(
  scheduledMessages,
  ({ one }) => ({
    lead: one(leads, {
      fields: [scheduledMessages.leadId],
      references: [leads.id],
    }),
    client: one(clients, {
      fields: [scheduledMessages.clientId],
      references: [clients.id],
    }),
  })
);

export const quarterlyCampaignsRelations = relations(
  quarterlyCampaigns,
  ({ one }) => ({
    client: one(clients, {
      fields: [quarterlyCampaigns.clientId],
      references: [clients.id],
    }),
    createdByUser: one(users, {
      fields: [quarterlyCampaigns.createdBy],
      references: [users.id],
    }),
    updatedByUser: one(users, {
      fields: [quarterlyCampaigns.updatedBy],
      references: [users.id],
    }),
  })
);

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  lead: one(leads, {
    fields: [appointments.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [appointments.clientId],
    references: [clients.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  lead: one(leads, {
    fields: [invoices.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  job: one(jobs, {
    fields: [invoices.jobId],
    references: [jobs.id],
  }),
  payments: many(payments),
  reminders: many(paymentReminders),
}));

export const blockedNumbersRelations = relations(
  blockedNumbers,
  ({ one }) => ({
    client: one(clients, {
      fields: [blockedNumbers.clientId],
      references: [clients.id],
    }),
  })
);

export const messageTemplatesRelations = relations(messageTemplates, ({ one }) => ({
  client: one(clients, {
    fields: [messageTemplates.clientId],
    references: [clients.id],
  }),
}));

export const dailyStatsRelations = relations(dailyStats, ({ one }) => ({
  client: one(clients, {
    fields: [dailyStats.clientId],
    references: [clients.id],
  }),
}));

export const escalationClaimsRelations = relations(escalationClaims, ({ one }) => ({
  lead: one(leads, {
    fields: [escalationClaims.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [escalationClaims.clientId],
    references: [clients.id],
  }),
  claimedByMember: one(clientMemberships, {
    fields: [escalationClaims.claimedBy],
    references: [clientMemberships.id],
  }),
}));

export const businessHoursRelations = relations(businessHours, ({ one }) => ({
  client: one(clients, {
    fields: [businessHours.clientId],
    references: [clients.id],
  }),
}));

export const callAttemptsRelations = relations(callAttempts, ({ one }) => ({
  lead: one(leads, {
    fields: [callAttempts.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [callAttempts.clientId],
    references: [clients.id],
  }),
  answeredByMember: one(clientMemberships, {
    fields: [callAttempts.answeredBy],
    references: [clientMemberships.id],
  }),
}));

export const magicLinkTokensRelations = relations(magicLinkTokens, ({ one }) => ({
  client: one(clients, {
    fields: [magicLinkTokens.clientId],
    references: [clients.id],
  }),
}));

// Flow Templates
export const flowTemplatesRelations = relations(flowTemplates, ({ many }) => ({
  steps: many(flowTemplateSteps),
  versions: many(flowTemplateVersions),
  flows: many(flows),
}));

export const flowTemplateStepsRelations = relations(flowTemplateSteps, ({ one }) => ({
  template: one(flowTemplates, {
    fields: [flowTemplateSteps.templateId],
    references: [flowTemplates.id],
  }),
}));

export const flowTemplateVersionsRelations = relations(flowTemplateVersions, ({ one }) => ({
  template: one(flowTemplates, {
    fields: [flowTemplateVersions.templateId],
    references: [flowTemplates.id],
  }),
}));

// Client Flows
export const flowsRelations = relations(flows, ({ one, many }) => ({
  client: one(clients, {
    fields: [flows.clientId],
    references: [clients.id],
  }),
  template: one(flowTemplates, {
    fields: [flows.templateId],
    references: [flowTemplates.id],
  }),
  steps: many(flowSteps),
  executions: many(flowExecutions),
  suggestedActions: many(suggestedActions),
}));

export const flowStepsRelations = relations(flowSteps, ({ one }) => ({
  flow: one(flows, {
    fields: [flowSteps.flowId],
    references: [flows.id],
  }),
  templateStep: one(flowTemplateSteps, {
    fields: [flowSteps.templateStepId],
    references: [flowTemplateSteps.id],
  }),
}));

// Flow Executions
export const flowExecutionsRelations = relations(flowExecutions, ({ one, many }) => ({
  flow: one(flows, {
    fields: [flowExecutions.flowId],
    references: [flows.id],
  }),
  lead: one(leads, {
    fields: [flowExecutions.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [flowExecutions.clientId],
    references: [clients.id],
  }),
  stepExecutions: many(flowStepExecutions),
}));

export const flowStepExecutionsRelations = relations(flowStepExecutions, ({ one }) => ({
  execution: one(flowExecutions, {
    fields: [flowStepExecutions.flowExecutionId],
    references: [flowExecutions.id],
  }),
  step: one(flowSteps, {
    fields: [flowStepExecutions.flowStepId],
    references: [flowSteps.id],
  }),
}));

export const suggestedActionsRelations = relations(suggestedActions, ({ one }) => ({
  lead: one(leads, {
    fields: [suggestedActions.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [suggestedActions.clientId],
    references: [clients.id],
  }),
  flow: one(flows, {
    fields: [suggestedActions.flowId],
    references: [flows.id],
  }),
  flowExecution: one(flowExecutions, {
    fields: [suggestedActions.flowExecutionId],
    references: [flowExecutions.id],
  }),
}));

// Knowledge Base
export const knowledgeBaseRelations = relations(knowledgeBase, ({ one }) => ({
  client: one(clients, {
    fields: [knowledgeBase.clientId],
    references: [clients.id],
  }),
}));

// Notification Preferences
export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  client: one(clients, {
    fields: [notificationPreferences.clientId],
    references: [clients.id],
  }),
}));

// Client Services
export const clientServicesRelations = relations(clientServices, ({ one, many }) => ({
  client: one(clients, { fields: [clientServices.clientId], references: [clients.id] }),
  jobs: many(jobs),
}));

// Jobs (Revenue Attribution)
export const jobsRelations = relations(jobs, ({ one, many }) => ({
  lead: one(leads, { fields: [jobs.leadId], references: [leads.id] }),
  client: one(clients, { fields: [jobs.clientId], references: [clients.id] }),
  service: one(clientServices, { fields: [jobs.serviceId], references: [clientServices.id] }),
  events: many(revenueEvents),
}));

export const revenueEventsRelations = relations(revenueEvents, ({ one }) => ({
  job: one(jobs, { fields: [revenueEvents.jobId], references: [jobs.id] }),
  client: one(clients, { fields: [revenueEvents.clientId], references: [clients.id] }),
}));

// Payments
export const paymentsRelations = relations(payments, ({ one, many }) => ({
  client: one(clients, { fields: [payments.clientId], references: [clients.id] }),
  lead: one(leads, { fields: [payments.leadId], references: [leads.id] }),
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
  reminders: many(paymentReminders),
}));

export const paymentRemindersRelations = relations(paymentReminders, ({ one }) => ({
  payment: one(payments, { fields: [paymentReminders.paymentId], references: [payments.id] }),
  invoice: one(invoices, { fields: [paymentReminders.invoiceId], references: [invoices.id] }),
}));

// Media Attachments
export const mediaAttachmentsRelations = relations(mediaAttachments, ({ one }) => ({
  client: one(clients, {
    fields: [mediaAttachments.clientId],
    references: [clients.id],
  }),
  lead: one(leads, {
    fields: [mediaAttachments.leadId],
    references: [leads.id],
  }),
  message: one(conversations, {
    fields: [mediaAttachments.messageId],
    references: [conversations.id],
  }),
}));

// Compliance
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

// Conversation Agent
export const leadContextRelations = relations(leadContext, ({ one }) => ({
  lead: one(leads, {
    fields: [leadContext.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [leadContext.clientId],
    references: [clients.id],
  }),
  matchedService: one(clientServices, {
    fields: [leadContext.matchedServiceId],
    references: [clientServices.id],
  }),
}));

export const agentDecisionsRelations = relations(agentDecisions, ({ one }) => ({
  client: one(clients, {
    fields: [agentDecisions.clientId],
    references: [clients.id],
  }),
  lead: one(leads, {
    fields: [agentDecisions.leadId],
    references: [leads.id],
  }),
  message: one(conversations, {
    fields: [agentDecisions.messageId],
    references: [conversations.id],
  }),
}));

export const escalationQueueRelations = relations(escalationQueue, ({ one }) => ({
  lead: one(leads, {
    fields: [escalationQueue.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [escalationQueue.clientId],
    references: [clients.id],
  }),
  assignedTeamMember: one(clientMemberships, {
    fields: [escalationQueue.assignedTo],
    references: [clientMemberships.id],
  }),
}));

export const escalationRulesRelations = relations(escalationRules, ({ one }) => ({
  client: one(clients, {
    fields: [escalationRules.clientId],
    references: [clients.id],
  }),
}));

export const conversationCheckpointsRelations = relations(conversationCheckpoints, ({ one }) => ({
  lead: one(leads, {
    fields: [conversationCheckpoints.leadId],
    references: [leads.id],
  }),
}));

export const clientAgentSettingsRelations = relations(clientAgentSettings, ({ one }) => ({
  client: one(clients, {
    fields: [clientAgentSettings.clientId],
    references: [clients.id],
  }),
}));

// Access Management
export const peopleRelations = relations(people, ({ many }) => ({
  users: many(users),
  clientMemberships: many(clientMemberships, { relationName: 'memberClientMemberships' }),
  invitedClientMemberships: many(clientMemberships, { relationName: 'invitedClientMemberships' }),
  agencyMembership: many(agencyMemberships, { relationName: 'memberAgencyMemberships' }),
  invitedAgencyMemberships: many(agencyMemberships, { relationName: 'invitedAgencyMemberships' }),
  auditLogEntries: many(auditLog),
}));

export const roleTemplatesRelations = relations(roleTemplates, ({ many }) => ({
  clientMemberships: many(clientMemberships),
  agencyMemberships: many(agencyMemberships),
}));

export const clientMembershipsRelations = relations(clientMemberships, ({ one }) => ({
  person: one(people, {
    fields: [clientMemberships.personId],
    references: [people.id],
    relationName: 'memberClientMemberships',
  }),
  client: one(clients, {
    fields: [clientMemberships.clientId],
    references: [clients.id],
  }),
  roleTemplate: one(roleTemplates, {
    fields: [clientMemberships.roleTemplateId],
    references: [roleTemplates.id],
  }),
  invitedByPerson: one(people, {
    fields: [clientMemberships.invitedBy],
    references: [people.id],
    relationName: 'invitedClientMemberships',
  }),
}));

export const agencyMembershipsRelations = relations(agencyMemberships, ({ one, many }) => ({
  person: one(people, {
    fields: [agencyMemberships.personId],
    references: [people.id],
    relationName: 'memberAgencyMemberships',
  }),
  roleTemplate: one(roleTemplates, {
    fields: [agencyMemberships.roleTemplateId],
    references: [roleTemplates.id],
  }),
  invitedByPerson: one(people, {
    fields: [agencyMemberships.invitedBy],
    references: [people.id],
    relationName: 'invitedAgencyMemberships',
  }),
  clientAssignments: many(agencyClientAssignments),
}));

export const agencyClientAssignmentsRelations = relations(agencyClientAssignments, ({ one }) => ({
  agencyMembership: one(agencyMemberships, {
    fields: [agencyClientAssignments.agencyMembershipId],
    references: [agencyMemberships.id],
  }),
  client: one(clients, {
    fields: [agencyClientAssignments.clientId],
    references: [clients.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  person: one(people, {
    fields: [auditLog.personId],
    references: [people.id],
  }),
  client: one(clients, {
    fields: [auditLog.clientId],
    references: [clients.id],
  }),
}));

// Error & Webhook Logs
export const errorLogRelations = relations(errorLog, ({ one }) => ({
  client: one(clients, {
    fields: [errorLog.clientId],
    references: [clients.id],
  }),
}));

export const webhookLogRelations = relations(webhookLog, ({ one }) => ({
  client: one(clients, {
    fields: [webhookLog.clientId],
    references: [clients.id],
  }),
}));

// Active Calls
export const activeCallsRelations = relations(activeCalls, ({ one }) => ({
  client: one(clients, {
    fields: [activeCalls.clientId],
    references: [clients.id],
  }),
}));

// A/B Tests
export const abTestsRelations = relations(abTests, ({ one, many }) => ({
  client: one(clients, {
    fields: [abTests.clientId],
    references: [clients.id],
  }),
  metrics: many(abTestMetrics),
}));

export const abTestMetricsRelations = relations(abTestMetrics, ({ one }) => ({
  test: one(abTests, {
    fields: [abTestMetrics.testId],
    references: [abTests.id],
  }),
}));

// Template Performance Metrics
export const templateVariantsRelations = relations(templateVariants, ({ many }) => ({
  performanceMetrics: many(templatePerformanceMetrics),
}));

export const templatePerformanceMetricsRelations = relations(
  templatePerformanceMetrics,
  ({ one }) => ({
    templateVariant: one(templateVariants, {
      fields: [templatePerformanceMetrics.templateVariantId],
      references: [templateVariants.id],
    }),
  })
);

// API Usage
export const apiUsageRelations = relations(apiUsage, ({ one }) => ({
  client: one(clients, {
    fields: [apiUsage.clientId],
    references: [clients.id],
  }),
  lead: one(leads, {
    fields: [apiUsage.leadId],
    references: [leads.id],
  }),
}));

export const apiUsageDailyRelations = relations(apiUsageDaily, ({ one }) => ({
  client: one(clients, {
    fields: [apiUsageDaily.clientId],
    references: [clients.id],
  }),
}));

export const apiUsageMonthlyRelations = relations(apiUsageMonthly, ({ one }) => ({
  client: one(clients, {
    fields: [apiUsageMonthly.clientId],
    references: [clients.id],
  }),
}));

export const usageAlertsRelations = relations(usageAlerts, ({ one }) => ({
  client: one(clients, {
    fields: [usageAlerts.clientId],
    references: [clients.id],
  }),
}));

// OTP Codes
export const otpCodesRelations = relations(otpCodes, ({ one }) => ({
  client: one(clients, {
    fields: [otpCodes.clientId],
    references: [clients.id],
  }),
  person: one(people, {
    fields: [otpCodes.personId],
    references: [people.id],
  }),
}));

// Template Metrics
export const templateMetricsDailyRelations = relations(templateMetricsDaily, ({ one }) => ({
  template: one(flowTemplates, {
    fields: [templateMetricsDaily.templateId],
    references: [flowTemplates.id],
  }),
}));

export const templateStepMetricsRelations = relations(templateStepMetrics, ({ one }) => ({
  template: one(flowTemplates, {
    fields: [templateStepMetrics.templateId],
    references: [flowTemplates.id],
  }),
}));

// Client Flow Outcomes
export const clientFlowOutcomesRelations = relations(clientFlowOutcomes, ({ one }) => ({
  client: one(clients, {
    fields: [clientFlowOutcomes.clientId],
    references: [clients.id],
  }),
  flow: one(flows, {
    fields: [clientFlowOutcomes.flowId],
    references: [flows.id],
  }),
}));

// Knowledge Gaps
export const knowledgeGapsRelations = relations(knowledgeGaps, ({ one }) => ({
  client: one(clients, {
    fields: [knowledgeGaps.clientId],
    references: [clients.id],
  }),
  owner: one(people, {
    fields: [knowledgeGaps.ownerPersonId],
    references: [people.id],
    relationName: 'knowledgeGapOwner',
  }),
  kbEntry: one(knowledgeBase, {
    fields: [knowledgeGaps.kbEntryId],
    references: [knowledgeBase.id],
  }),
  resolvedByPerson: one(people, {
    fields: [knowledgeGaps.resolvedByPersonId],
    references: [people.id],
    relationName: 'knowledgeGapResolvedBy',
  }),
  verifiedByPerson: one(people, {
    fields: [knowledgeGaps.verifiedByPersonId],
    references: [people.id],
    relationName: 'knowledgeGapVerifiedBy',
  }),
}));

// Onboarding Quality
export const onboardingQualitySnapshotsRelations = relations(
  onboardingQualitySnapshots,
  ({ one }) => ({
    client: one(clients, {
      fields: [onboardingQualitySnapshots.clientId],
      references: [clients.id],
    }),
    evaluatedByPerson: one(people, {
      fields: [onboardingQualitySnapshots.evaluatedByPersonId],
      references: [people.id],
    }),
  })
);

export const onboardingQualityOverridesRelations = relations(
  onboardingQualityOverrides,
  ({ one }) => ({
    client: one(clients, {
      fields: [onboardingQualityOverrides.clientId],
      references: [clients.id],
    }),
    approvedByPerson: one(people, {
      fields: [onboardingQualityOverrides.approvedByPersonId],
      references: [people.id],
    }),
  })
);

// Reviews
export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  client: one(clients, {
    fields: [reviews.clientId],
    references: [clients.id],
  }),
  matchedLead: one(leads, {
    fields: [reviews.matchedLeadId],
    references: [leads.id],
  }),
  responses: many(reviewResponses),
}));

export const reviewSourcesRelations = relations(reviewSources, ({ one }) => ({
  client: one(clients, {
    fields: [reviewSources.clientId],
    references: [clients.id],
  }),
}));

export const reviewMetricsRelations = relations(reviewMetrics, ({ one }) => ({
  client: one(clients, {
    fields: [reviewMetrics.clientId],
    references: [clients.id],
  }),
}));

export const responseTemplatesRelations = relations(responseTemplates, ({ one, many }) => ({
  client: one(clients, {
    fields: [responseTemplates.clientId],
    references: [clients.id],
  }),
  reviewResponses: many(reviewResponses),
}));

export const reviewResponsesRelations = relations(reviewResponses, ({ one }) => ({
  review: one(reviews, {
    fields: [reviewResponses.reviewId],
    references: [reviews.id],
  }),
  client: one(clients, {
    fields: [reviewResponses.clientId],
    references: [clients.id],
  }),
  template: one(responseTemplates, {
    fields: [reviewResponses.templateId],
    references: [responseTemplates.id],
  }),
  submittedByPerson: one(people, {
    fields: [reviewResponses.submittedBy],
    references: [people.id],
    relationName: 'reviewResponseSubmittedBy',
  }),
  approvedByPerson: one(people, {
    fields: [reviewResponses.approvedBy],
    references: [people.id],
    relationName: 'reviewResponseApprovedBy',
  }),
}));

// Calendar
export const calendarIntegrationsRelations = relations(calendarIntegrations, ({ one }) => ({
  client: one(clients, {
    fields: [calendarIntegrations.clientId],
    references: [clients.id],
  }),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  client: one(clients, {
    fields: [calendarEvents.clientId],
    references: [clients.id],
  }),
  lead: one(leads, {
    fields: [calendarEvents.leadId],
    references: [leads.id],
  }),
  assignedTeamMember: one(clientMemberships, {
    fields: [calendarEvents.assignedTeamMemberId],
    references: [clientMemberships.id],
  }),
  job: one(jobs, {
    fields: [calendarEvents.jobId],
    references: [jobs.id],
  }),
}));

// Voice Calls
export const voiceCallsRelations = relations(voiceCalls, ({ one }) => ({
  client: one(clients, {
    fields: [voiceCalls.clientId],
    references: [clients.id],
  }),
  lead: one(leads, {
    fields: [voiceCalls.leadId],
    references: [leads.id],
  }),
}));

// Billing & Subscriptions
export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  client: one(clients, {
    fields: [subscriptions.clientId],
    references: [clients.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
  invoices: many(subscriptionInvoices),
  usageRecords: many(usageRecords),
  billingEvents: many(billingEvents),
}));

export const billingPaymentMethodsRelations = relations(billingPaymentMethods, ({ one, many }) => ({
  client: one(clients, {
    fields: [billingPaymentMethods.clientId],
    references: [clients.id],
  }),
  invoices: many(subscriptionInvoices),
  billingEvents: many(billingEvents),
}));

export const subscriptionInvoicesRelations = relations(
  subscriptionInvoices,
  ({ one, many }) => ({
    client: one(clients, {
      fields: [subscriptionInvoices.clientId],
      references: [clients.id],
    }),
    subscription: one(subscriptions, {
      fields: [subscriptionInvoices.subscriptionId],
      references: [subscriptions.id],
    }),
    paymentMethod: one(billingPaymentMethods, {
      fields: [subscriptionInvoices.paymentMethodId],
      references: [billingPaymentMethods.id],
    }),
    usageRecords: many(usageRecords),
    addonBillingEvents: many(addonBillingEvents),
  })
);

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  client: one(clients, {
    fields: [usageRecords.clientId],
    references: [clients.id],
  }),
  subscription: one(subscriptions, {
    fields: [usageRecords.subscriptionId],
    references: [subscriptions.id],
  }),
  billedOnInvoice: one(subscriptionInvoices, {
    fields: [usageRecords.billedOnInvoiceId],
    references: [subscriptionInvoices.id],
  }),
}));

export const billingEventsRelations = relations(billingEvents, ({ one }) => ({
  client: one(clients, {
    fields: [billingEvents.clientId],
    references: [clients.id],
  }),
  subscription: one(subscriptions, {
    fields: [billingEvents.subscriptionId],
    references: [subscriptions.id],
  }),
  invoice: one(subscriptionInvoices, {
    fields: [billingEvents.invoiceId],
    references: [subscriptionInvoices.id],
  }),
  paymentMethod: one(billingPaymentMethods, {
    fields: [billingEvents.paymentMethodId],
    references: [billingPaymentMethods.id],
  }),
}));

export const addonBillingEventsRelations = relations(addonBillingEvents, ({ one }) => ({
  client: one(clients, {
    fields: [addonBillingEvents.clientId],
    references: [clients.id],
  }),
  invoice: one(subscriptionInvoices, {
    fields: [addonBillingEvents.invoiceId],
    references: [subscriptionInvoices.id],
  }),
}));

// Analytics
export const analyticsDailyRelations = relations(analyticsDaily, ({ one }) => ({
  client: one(clients, {
    fields: [analyticsDaily.clientId],
    references: [clients.id],
  }),
}));

export const analyticsWeeklyRelations = relations(analyticsWeekly, ({ one }) => ({
  client: one(clients, {
    fields: [analyticsWeekly.clientId],
    references: [clients.id],
  }),
}));

export const analyticsMonthlyRelations = relations(analyticsMonthly, ({ one }) => ({
  client: one(clients, {
    fields: [analyticsMonthly.clientId],
    references: [clients.id],
  }),
}));

export const funnelEventsRelations = relations(funnelEvents, ({ one }) => ({
  client: one(clients, {
    fields: [funnelEvents.clientId],
    references: [clients.id],
  }),
  lead: one(leads, {
    fields: [funnelEvents.leadId],
    references: [leads.id],
  }),
  agentDecision: one(agentDecisions, {
    fields: [funnelEvents.agentDecisionId],
    references: [agentDecisions.id],
  }),
}));

export const clientCohortsRelations = relations(clientCohorts, ({ one }) => ({
  client: one(clients, {
    fields: [clientCohorts.clientId],
    references: [clients.id],
  }),
}));

// Support
export const supportMessagesRelations = relations(supportMessages, ({ one, many }) => ({
  user: one(users, {
    fields: [supportMessages.userId],
    references: [users.id],
  }),
  replies: many(supportReplies),
}));

export const supportRepliesRelations = relations(supportReplies, ({ one }) => ({
  supportMessage: one(supportMessages, {
    fields: [supportReplies.supportMessageId],
    references: [supportMessages.id],
  }),
}));

// NPS Surveys
export const npsSurveysRelations = relations(npsSurveys, ({ one }) => ({
  client: one(clients, {
    fields: [npsSurveys.clientId],
    references: [clients.id],
  }),
  lead: one(leads, {
    fields: [npsSurveys.leadId],
    references: [leads.id],
  }),
  appointment: one(appointments, {
    fields: [npsSurveys.appointmentId],
    references: [appointments.id],
  }),
}));

// API Keys
export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  client: one(clients, {
    fields: [apiKeys.clientId],
    references: [clients.id],
  }),
}));

// Client Phone Numbers
export const clientPhoneNumbersRelations = relations(clientPhoneNumbers, ({ one }) => ({
  client: one(clients, {
    fields: [clientPhoneNumbers.clientId],
    references: [clients.id],
  }),
}));

// Integration Webhooks
export const integrationWebhooksRelations = relations(integrationWebhooks, ({ one }) => ({
  client: one(clients, {
    fields: [integrationWebhooks.clientId],
    references: [clients.id],
  }),
}));

// Agency Messages
export const agencyMessagesRelations = relations(agencyMessages, ({ one }) => ({
  client: one(clients, {
    fields: [agencyMessages.clientId],
    references: [clients.id],
  }),
  inReplyToMessage: one(agencyMessages, {
    fields: [agencyMessages.inReplyTo],
    references: [agencyMessages.id],
    relationName: 'agencyMessageReplies',
  }),
}));
