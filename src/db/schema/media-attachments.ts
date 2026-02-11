import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { leads } from './leads';
import { conversations } from './conversations';

export const mediaTypeEnum = pgEnum('media_type', [
  'image',
  'video',
  'audio',
  'document',
  'other',
]);

export const mediaAttachments = pgTable(
  'media_attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').references(() => conversations.id, { onDelete: 'set null' }),

    // File info
    type: mediaTypeEnum('type').notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    fileName: varchar('file_name', { length: 255 }),
    fileSize: integer('file_size'),

    // Storage
    storageKey: varchar('storage_key', { length: 500 }).notNull(), // R2 key
    publicUrl: varchar('public_url', { length: 1000 }),
    thumbnailKey: varchar('thumbnail_key', { length: 500 }),
    thumbnailUrl: varchar('thumbnail_url', { length: 1000 }),

    // Twilio source
    twilioMediaSid: varchar('twilio_media_sid', { length: 50 }),
    twilioMediaUrl: varchar('twilio_media_url', { length: 1000 }),

    // AI analysis
    aiDescription: text('ai_description'),
    aiTags: jsonb('ai_tags').$type<string[]>(),

    // Metadata
    width: integer('width'),
    height: integer('height'),
    duration: integer('duration'), // seconds for video/audio

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_media_attachments_lead_id').on(table.leadId),
    index('idx_media_attachments_client_id').on(table.clientId),
    index('idx_media_attachments_message_id').on(table.messageId),
  ]
);

export type MediaAttachment = typeof mediaAttachments.$inferSelect;
export type NewMediaAttachment = typeof mediaAttachments.$inferInsert;
