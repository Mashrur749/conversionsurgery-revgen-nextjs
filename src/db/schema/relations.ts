import { relations } from 'drizzle-orm';
import { clients } from './clients';
import { leads } from './leads';
import { conversations } from './conversations';
import { scheduledMessages } from './scheduled-messages';
import { appointments } from './appointments';
import { invoices } from './invoices';
import { blockedNumbers } from './blocked-numbers';
import { messageTemplates } from './message-templates';
import { dailyStats } from './daily-stats';

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
