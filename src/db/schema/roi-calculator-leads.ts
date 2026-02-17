import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const roiCalculatorLeads = pgTable(
  'roi_calculator_leads',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Contact info
    email: text('email').notNull(),
    name: text('name').notNull(),
    businessName: text('business_name').notNull(),
    phone: varchar('phone', { length: 20 }),

    // Calculator inputs
    trade: varchar('trade', { length: 100 }),
    monthlyEstimates: integer('monthly_estimates'),
    avgProjectValue: numeric('avg_project_value', { precision: 12, scale: 2 }),
    currentCloseRate: numeric('current_close_rate', { precision: 5, scale: 2 }),
    responseTime: varchar('response_time', { length: 50 }),
    afterHoursPercent: numeric('after_hours_percent', { precision: 5, scale: 2 }),
    followUpConsistency: varchar('follow_up_consistency', { length: 50 }),
    followUpTouches: integer('follow_up_touches'),
    hoursPerWeek: numeric('hours_per_week', { precision: 5, scale: 1 }),
    hourlyValue: numeric('hourly_value', { precision: 8, scale: 2 }),

    // Calculated results
    lostRevenueAnnual: numeric('lost_revenue_annual', { precision: 14, scale: 2 }),
    potentialRevenueAnnual: numeric('potential_revenue_annual', {
      precision: 14,
      scale: 2,
    }),
    projectedRoi: numeric('projected_roi', { precision: 8, scale: 2 }),

    // Attribution
    utmSource: varchar('utm_source', { length: 255 }),
    utmMedium: varchar('utm_medium', { length: 255 }),
    utmCampaign: varchar('utm_campaign', { length: 255 }),
    referrer: text('referrer'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_roi_leads_email').on(table.email),
    index('idx_roi_leads_created_at').on(table.createdAt),
  ]
);

export type RoiCalculatorLead = typeof roiCalculatorLeads.$inferSelect;
export type NewRoiCalculatorLead = typeof roiCalculatorLeads.$inferInsert;
