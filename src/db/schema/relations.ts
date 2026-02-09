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
import { teamMembers } from './team-members';
import { escalationClaims } from './escalation-claims';
import { businessHours } from './business-hours';
import { callAttempts } from './call-attempts';
import { magicLinkTokens } from './magic-link-tokens';
import { flowTemplates, flowTemplateSteps, flowTemplateVersions } from './flow-templates';
import { flows, flowSteps } from './flows';
import { flowExecutions, flowStepExecutions, suggestedActions } from './flow-executions';
import { knowledgeBase } from './knowledge-base';
import { notificationPreferences } from './notification-preferences';
import { jobs } from './jobs';
import { revenueEvents } from './revenue-events';
import { mediaAttachments } from './media-attachments';

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
  teamMembers: many(teamMembers),
  escalationClaims: many(escalationClaims),
  businessHours: many(businessHours),
  callAttempts: many(callAttempts),
  magicLinkTokens: many(magicLinkTokens),
  flows: many(flows),
  flowExecutions: many(flowExecutions),
  suggestedActions: many(suggestedActions),
  knowledgeBase: many(knowledgeBase),
  notificationPreferences: many(notificationPreferences),
  jobs: many(jobs),
  revenueEvents: many(revenueEvents),
  mediaAttachments: many(mediaAttachments),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  client: one(clients, { fields: [users.clientId], references: [clients.id] }),
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

export const invoicesRelations = relations(invoices, ({ one }) => ({
  lead: one(leads, {
    fields: [invoices.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
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

export const teamMembersRelations = relations(teamMembers, ({ one, many }) => ({
  client: one(clients, {
    fields: [teamMembers.clientId],
    references: [clients.id],
  }),
  claims: many(escalationClaims),
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
  claimedByMember: one(teamMembers, {
    fields: [escalationClaims.claimedBy],
    references: [teamMembers.id],
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
  answeredByMember: one(teamMembers, {
    fields: [callAttempts.answeredBy],
    references: [teamMembers.id],
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

// Jobs (Revenue Attribution)
export const jobsRelations = relations(jobs, ({ one, many }) => ({
  lead: one(leads, { fields: [jobs.leadId], references: [leads.id] }),
  client: one(clients, { fields: [jobs.clientId], references: [clients.id] }),
  events: many(revenueEvents),
}));

export const revenueEventsRelations = relations(revenueEvents, ({ one }) => ({
  job: one(jobs, { fields: [revenueEvents.jobId], references: [jobs.id] }),
  client: one(clients, { fields: [revenueEvents.clientId], references: [clients.id] }),
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
