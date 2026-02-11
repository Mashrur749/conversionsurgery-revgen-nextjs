CREATE TABLE "analytics_daily" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"date" date NOT NULL,
	"new_leads" integer DEFAULT 0 NOT NULL,
	"leads_from_missed_calls" integer DEFAULT 0 NOT NULL,
	"leads_from_web_forms" integer DEFAULT 0 NOT NULL,
	"leads_from_referrals" integer DEFAULT 0 NOT NULL,
	"leads_from_other" integer DEFAULT 0 NOT NULL,
	"total_conversations" integer DEFAULT 0 NOT NULL,
	"ai_responses" integer DEFAULT 0 NOT NULL,
	"human_responses" integer DEFAULT 0 NOT NULL,
	"escalations" integer DEFAULT 0 NOT NULL,
	"avg_response_time_seconds" integer,
	"inbound_messages" integer DEFAULT 0 NOT NULL,
	"outbound_messages" integer DEFAULT 0 NOT NULL,
	"appointments_booked" integer DEFAULT 0 NOT NULL,
	"quotes_requested" integer DEFAULT 0 NOT NULL,
	"quotes_sent" integer DEFAULT 0 NOT NULL,
	"jobs_won" integer DEFAULT 0 NOT NULL,
	"jobs_lost" integer DEFAULT 0 NOT NULL,
	"revenue_attributed_cents" integer DEFAULT 0 NOT NULL,
	"invoices_sent_cents" integer DEFAULT 0 NOT NULL,
	"payments_collected_cents" integer DEFAULT 0 NOT NULL,
	"review_requests_sent" integer DEFAULT 0 NOT NULL,
	"reviews_received" integer DEFAULT 0 NOT NULL,
	"avg_rating" real,
	"leads_new" integer DEFAULT 0,
	"leads_qualifying" integer DEFAULT 0,
	"leads_nurturing" integer DEFAULT 0,
	"leads_hot" integer DEFAULT 0,
	"leads_booked" integer DEFAULT 0,
	"leads_lost" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_weekly" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"new_leads" integer DEFAULT 0 NOT NULL,
	"total_conversations" integer DEFAULT 0 NOT NULL,
	"appointments_booked" integer DEFAULT 0 NOT NULL,
	"jobs_won" integer DEFAULT 0 NOT NULL,
	"revenue_attributed_cents" integer DEFAULT 0 NOT NULL,
	"payments_collected_cents" integer DEFAULT 0 NOT NULL,
	"lead_to_appointment_rate" integer,
	"appointment_to_job_rate" integer,
	"overall_conversion_rate" integer,
	"avg_response_time_seconds" integer,
	"response_within_five_min" integer,
	"leads_change_percent" integer,
	"revenue_change_percent" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_monthly" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"new_leads" integer DEFAULT 0 NOT NULL,
	"qualified_leads" integer DEFAULT 0 NOT NULL,
	"appointments_booked" integer DEFAULT 0 NOT NULL,
	"quotes_generated" integer DEFAULT 0 NOT NULL,
	"jobs_won" integer DEFAULT 0 NOT NULL,
	"jobs_lost" integer DEFAULT 0 NOT NULL,
	"revenue_attributed_cents" integer DEFAULT 0 NOT NULL,
	"avg_job_value_cents" integer,
	"payments_collected_cents" integer DEFAULT 0 NOT NULL,
	"outstanding_invoices_cents" integer DEFAULT 0,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"ai_handled_percent" integer,
	"escalation_rate" integer,
	"reviews_received" integer DEFAULT 0 NOT NULL,
	"avg_rating" real,
	"five_star_reviews" integer DEFAULT 0,
	"lead_to_job_rate" integer,
	"platform_cost_cents" integer DEFAULT 0,
	"roi_multiple" real,
	"previous_month_revenue_change_pct" integer,
	"previous_month_leads_change_pct" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_analytics" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"date" date NOT NULL,
	"total_clients" integer DEFAULT 0 NOT NULL,
	"active_clients" integer DEFAULT 0 NOT NULL,
	"new_clients" integer DEFAULT 0 NOT NULL,
	"churned_clients" integer DEFAULT 0 NOT NULL,
	"mrr_cents" integer DEFAULT 0 NOT NULL,
	"new_mrr_cents" integer DEFAULT 0 NOT NULL,
	"churned_mrr_cents" integer DEFAULT 0 NOT NULL,
	"expansion_mrr_cents" integer DEFAULT 0 NOT NULL,
	"total_leads" integer DEFAULT 0 NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"total_ai_responses" integer DEFAULT 0 NOT NULL,
	"total_escalations" integer DEFAULT 0 NOT NULL,
	"total_api_costs_cents" integer DEFAULT 0 NOT NULL,
	"avg_cost_per_client_cents" integer,
	"avg_client_satisfaction" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_analytics_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "funnel_events" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"event_data" jsonb,
	"value_cents" integer,
	"source" varchar(50),
	"campaign" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_cohorts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"cohort_month" varchar(7) NOT NULL,
	"month_1_active" boolean,
	"month_2_active" boolean,
	"month_3_active" boolean,
	"month_6_active" boolean,
	"month_12_active" boolean,
	"month_1_revenue_cents" integer,
	"month_3_revenue_cents" integer,
	"month_6_revenue_cents" integer,
	"month_12_revenue_cents" integer,
	"lifetime_revenue_cents" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_cohorts_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"page" varchar(500) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_weekly" ADD CONSTRAINT "analytics_weekly_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_monthly" ADD CONSTRAINT "analytics_monthly_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_cohorts" ADD CONSTRAINT "client_cohorts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_daily_unique_idx" ON "analytics_daily" USING btree ("client_id","date");--> statement-breakpoint
CREATE INDEX "analytics_daily_date_idx" ON "analytics_daily" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_weekly_unique_idx" ON "analytics_weekly" USING btree ("client_id","week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_monthly_unique_idx" ON "analytics_monthly" USING btree ("client_id","month");--> statement-breakpoint
CREATE INDEX "analytics_monthly_month_idx" ON "analytics_monthly" USING btree ("month");--> statement-breakpoint
CREATE INDEX "platform_analytics_date_idx" ON "platform_analytics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "funnel_events_client_idx" ON "funnel_events" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "funnel_events_lead_idx" ON "funnel_events" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "funnel_events_type_idx" ON "funnel_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "funnel_events_created_idx" ON "funnel_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "client_cohorts_cohort_idx" ON "client_cohorts" USING btree ("cohort_month");