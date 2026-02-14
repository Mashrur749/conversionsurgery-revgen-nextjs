import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const helpArticles = pgTable(
  'help_articles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    content: text('content').notNull(),
    category: varchar('category', { length: 100 }),
    sortOrder: integer('sort_order').default(0),
    isPublished: boolean('is_published').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_help_articles_slug').on(table.slug),
    index('idx_help_articles_published').on(table.isPublished),
  ]
);

export type HelpArticle = typeof helpArticles.$inferSelect;
export type NewHelpArticle = typeof helpArticles.$inferInsert;
