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
import { flowTemplates, flowTemplateSteps, flowTemplateVersions } from './flow-templates';
import { flows, flowSteps } from './flows';
import { flowExecutions, flowStepExecutions, suggestedActions } from './flow-executions';
import { knowledgeBase } from './knowledge-base';
import { notificationPreferences } from './notification-preferences';
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
import { people } from './people';
import { roleTemplates } from './role-templates';
import { clientMemberships } from './client-memberships';
import { agencyMemberships } from './agency-memberships';
import { agencyClientAssignments } from './agency-client-assignments';
import { auditLog } from './audit-log';

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
}));

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
