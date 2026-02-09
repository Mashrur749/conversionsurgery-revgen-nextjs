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
}));

export const conversationsRelations = relations(conversations, ({ one }) => ({
  lead: one(leads, {
    fields: [conversations.leadId],
    references: [leads.id],
  }),
  client: one(clients, {
    fields: [conversations.clientId],
    references: [clients.id],
  }),
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
