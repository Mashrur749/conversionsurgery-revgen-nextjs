CREATE TYPE "public"."api_service" AS ENUM('openai', 'twilio_sms', 'twilio_voice', 'twilio_phone', 'stripe', 'google_places', 'cloudflare_r2');--> statement-breakpoint
CREATE TYPE "public"."flow_approval" AS ENUM('auto', 'suggest', 'ask_sms');--> statement-breakpoint
CREATE TYPE "public"."flow_category" AS ENUM('missed_call', 'form_response', 'estimate', 'appointment', 'payment', 'review', 'referral', 'custom');--> statement-breakpoint
CREATE TYPE "public"."flow_sync_mode" AS ENUM('inherit', 'override', 'detached');--> statement-breakpoint
CREATE TYPE "public"."flow_trigger" AS ENUM('webhook', 'scheduled', 'manual', 'ai_suggested');--> statement-breakpoint
CREATE TYPE "public"."knowledge_category" AS ENUM('services', 'pricing', 'faq', 'policies', 'about', 'custom');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('lead', 'quoted', 'won', 'lost', 'completed');--> statement-breakpoint
CREATE TABLE "api_usage" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"service" "api_service" NOT NULL,
	"operation" varchar(50) NOT NULL,
	"model" varchar(50),
	"input_tokens" integer,
	"output_tokens" integer,
	"units" integer DEFAULT 1,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"lead_id" uuid,
	"message_id" uuid,
	"flow_execution_id" uuid,
	"external_id" varchar(100),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage_daily" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"date" date NOT NULL,
	"service" "api_service" NOT NULL,
	"total_requests" integer DEFAULT 0 NOT NULL,
	"total_tokens_in" integer DEFAULT 0 NOT NULL,
	"total_tokens_out" integer DEFAULT 0 NOT NULL,
	"total_units" integer DEFAULT 0 NOT NULL,
	"total_cost_cents" integer DEFAULT 0 NOT NULL,
	"operation_breakdown" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage_monthly" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"openai_cost_cents" integer DEFAULT 0 NOT NULL,
	"twilio_sms_cost_cents" integer DEFAULT 0 NOT NULL,
	"twilio_voice_cost_cents" integer DEFAULT 0 NOT NULL,
	"twilio_phone_cost_cents" integer DEFAULT 0 NOT NULL,
	"stripe_cost_cents" integer DEFAULT 0 NOT NULL,
	"google_places_cost_cents" integer DEFAULT 0 NOT NULL,
	"storage_cost_cents" integer DEFAULT 0 NOT NULL,
	"total_cost_cents" integer DEFAULT 0 NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"total_ai_calls" integer DEFAULT 0 NOT NULL,
	"total_voice_minutes" integer DEFAULT 0 NOT NULL,
	"previous_month_cost_cents" integer,
	"cost_change_percent" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_alerts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"alert_type" varchar(30) NOT NULL,
	"severity" varchar(10) NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"acknowledged" boolean DEFAULT false,
	"acknowledged_at" timestamp,
	"acknowledged_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "magic_link_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "flow_template_steps" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"template_id" uuid,
	"step_number" integer NOT NULL,
	"name" varchar(100),
	"delay_minutes" integer DEFAULT 0,
	"message_template" text NOT NULL,
	"skip_conditions" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "flow_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"template_id" uuid,
	"version" integer NOT NULL,
	"snapshot" jsonb,
	"change_notes" text,
	"published_at" timestamp DEFAULT now(),
	"published_by" uuid
);
--> statement-breakpoint
CREATE TABLE "flow_templates" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"description" text,
	"category" "flow_category" NOT NULL,
	"version" integer DEFAULT 1,
	"is_published" boolean DEFAULT false,
	"published_at" timestamp,
	"default_trigger" "flow_trigger" DEFAULT 'manual',
	"default_approval_mode" "flow_approval" DEFAULT 'auto',
	"usage_count" integer DEFAULT 0,
	"tags" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "flow_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "flow_steps" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"flow_id" uuid,
	"template_step_id" uuid,
	"step_number" integer NOT NULL,
	"name" varchar(100),
	"use_template_delay" boolean DEFAULT true,
	"custom_delay_minutes" integer,
	"use_template_message" boolean DEFAULT true,
	"custom_message" text,
	"skip_conditions" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "flows" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid,
	"name" varchar(100) NOT NULL,
	"description" text,
	"category" "flow_category" NOT NULL,
	"template_id" uuid,
	"template_version" integer,
	"sync_mode" "flow_sync_mode" DEFAULT 'inherit',
	"trigger" "flow_trigger" DEFAULT 'manual' NOT NULL,
	"approval_mode" "flow_approval" DEFAULT 'auto',
	"ai_trigger_conditions" jsonb,
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "flow_executions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"flow_id" uuid,
	"lead_id" uuid,
	"client_id" uuid,
	"status" varchar(20) DEFAULT 'active',
	"current_step" integer DEFAULT 1,
	"total_steps" integer,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"cancel_reason" varchar(255),
	"next_step_at" timestamp,
	"triggered_by" varchar(20),
	"triggered_by_user_id" uuid,
	"approval_status" varchar(20),
	"approval_requested_at" timestamp,
	"approval_responded_at" timestamp,
	"approved_by" varchar(255),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "flow_step_executions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"flow_execution_id" uuid,
	"flow_step_id" uuid,
	"step_number" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"scheduled_at" timestamp,
	"executed_at" timestamp,
	"message_content" text,
	"message_sid" varchar(50),
	"skip_reason" varchar(100),
	"error" text,
	"retry_count" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "suggested_actions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"lead_id" uuid,
	"client_id" uuid,
	"flow_id" uuid,
	"detected_signal" varchar(100),
	"confidence" integer,
	"reason" text,
	"trigger_message_id" uuid,
	"status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"responded_at" timestamp,
	"responded_by" varchar(255),
	"flow_execution_id" uuid
);
--> statement-breakpoint
CREATE TABLE "template_metrics_daily" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"template_id" uuid,
	"date" date NOT NULL,
	"executions_started" integer DEFAULT 0,
	"executions_completed" integer DEFAULT 0,
	"executions_cancelled" integer DEFAULT 0,
	"messages_sent" integer DEFAULT 0,
	"messages_delivered" integer DEFAULT 0,
	"messages_failed" integer DEFAULT 0,
	"leads_responded" integer DEFAULT 0,
	"total_responses" integer DEFAULT 0,
	"avg_response_time_minutes" integer,
	"conversions" integer DEFAULT 0,
	"conversion_value" numeric(10, 2),
	"opt_outs" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "template_step_metrics" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"template_id" uuid,
	"step_number" integer NOT NULL,
	"date" date NOT NULL,
	"messages_sent" integer DEFAULT 0,
	"responses_received" integer DEFAULT 0,
	"skipped" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_flow_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid,
	"flow_id" uuid,
	"period" varchar(10) NOT NULL,
	"leads_contacted" integer DEFAULT 0,
	"leads_responded" integer DEFAULT 0,
	"conversions" integer DEFAULT 0,
	"revenue" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_base" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"category" "knowledge_category" NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"keywords" text,
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid,
	"sms_new_lead" boolean DEFAULT true,
	"sms_escalation" boolean DEFAULT true,
	"sms_weekly_summary" boolean DEFAULT true,
	"sms_flow_approval" boolean DEFAULT true,
	"sms_negative_review" boolean DEFAULT true,
	"email_new_lead" boolean DEFAULT false,
	"email_daily_summary" boolean DEFAULT false,
	"email_weekly_summary" boolean DEFAULT true,
	"email_monthly_report" boolean DEFAULT true,
	"quiet_hours_enabled" boolean DEFAULT false,
	"quiet_hours_start" varchar(5) DEFAULT '22:00',
	"quiet_hours_end" varchar(5) DEFAULT '07:00',
	"urgent_override" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "notification_preferences_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "cancellation_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"reason" text,
	"feedback" text,
	"value_shown" jsonb,
	"scheduled_call_at" timestamp,
	"grace_period_ends" timestamp,
	"created_at" timestamp DEFAULT now(),
	"processed_at" timestamp,
	"processed_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"lead_id" uuid,
	"client_id" uuid,
	"status" "job_status" DEFAULT 'lead',
	"quote_amount" integer,
	"deposit_amount" integer,
	"final_amount" integer,
	"paid_amount" integer DEFAULT 0,
	"description" text,
	"address" text,
	"scheduled_date" date,
	"completed_date" date,
	"won_at" timestamp,
	"lost_at" timestamp,
	"lost_reason" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "revenue_events" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"job_id" uuid,
	"client_id" uuid,
	"event_type" varchar(50) NOT NULL,
	"amount" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "weekly_summary_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "weekly_summary_day" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "weekly_summary_time" varchar(5) DEFAULT '08:00';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "last_weekly_summary_at" timestamp;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "conversation_mode" varchar(10) DEFAULT 'ai';--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "human_takeover_at" timestamp;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "human_takeover_by" varchar(255);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "score" integer DEFAULT 50;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "score_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "score_factors" jsonb;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "temperature" varchar(10) DEFAULT 'warm';--> statement-breakpoint
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_daily" ADD CONSTRAINT "api_usage_daily_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_monthly" ADD CONSTRAINT "api_usage_monthly_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_alerts" ADD CONSTRAINT "usage_alerts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_template_steps" ADD CONSTRAINT "flow_template_steps_template_id_flow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."flow_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_template_versions" ADD CONSTRAINT "flow_template_versions_template_id_flow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."flow_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_steps" ADD CONSTRAINT "flow_steps_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_steps" ADD CONSTRAINT "flow_steps_template_step_id_flow_template_steps_id_fk" FOREIGN KEY ("template_step_id") REFERENCES "public"."flow_template_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_template_id_flow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."flow_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_executions" ADD CONSTRAINT "flow_executions_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_executions" ADD CONSTRAINT "flow_executions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_executions" ADD CONSTRAINT "flow_executions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_step_executions" ADD CONSTRAINT "flow_step_executions_flow_execution_id_flow_executions_id_fk" FOREIGN KEY ("flow_execution_id") REFERENCES "public"."flow_executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_step_executions" ADD CONSTRAINT "flow_step_executions_flow_step_id_flow_steps_id_fk" FOREIGN KEY ("flow_step_id") REFERENCES "public"."flow_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggested_actions" ADD CONSTRAINT "suggested_actions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggested_actions" ADD CONSTRAINT "suggested_actions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggested_actions" ADD CONSTRAINT "suggested_actions_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggested_actions" ADD CONSTRAINT "suggested_actions_flow_execution_id_flow_executions_id_fk" FOREIGN KEY ("flow_execution_id") REFERENCES "public"."flow_executions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_metrics_daily" ADD CONSTRAINT "template_metrics_daily_template_id_flow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."flow_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_step_metrics" ADD CONSTRAINT "template_step_metrics_template_id_flow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."flow_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_flow_outcomes" ADD CONSTRAINT "client_flow_outcomes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_flow_outcomes" ADD CONSTRAINT "client_flow_outcomes_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_usage_client_idx" ON "api_usage" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "api_usage_service_idx" ON "api_usage" USING btree ("service");--> statement-breakpoint
CREATE INDEX "api_usage_created_at_idx" ON "api_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_usage_client_date_idx" ON "api_usage" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "api_usage_daily_unique_idx" ON "api_usage_daily" USING btree ("client_id","date","service");--> statement-breakpoint
CREATE INDEX "api_usage_daily_date_idx" ON "api_usage_daily" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "api_usage_monthly_unique_idx" ON "api_usage_monthly" USING btree ("client_id","month");--> statement-breakpoint
CREATE INDEX "api_usage_monthly_month_idx" ON "api_usage_monthly" USING btree ("month");--> statement-breakpoint
CREATE INDEX "usage_alerts_client_idx" ON "usage_alerts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "usage_alerts_unack_idx" ON "usage_alerts" USING btree ("acknowledged");--> statement-breakpoint
CREATE INDEX "idx_magic_link_tokens_token" ON "magic_link_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "flows_template_idx" ON "flows" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "flows_client_idx" ON "flows" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "flow_executions_lead_idx" ON "flow_executions" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "flow_executions_status_idx" ON "flow_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "flow_executions_client_idx" ON "flow_executions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "suggested_actions_lead_idx" ON "suggested_actions" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "suggested_actions_status_idx" ON "suggested_actions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "template_date_idx" ON "template_metrics_daily" USING btree ("template_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "template_step_date_idx" ON "template_step_metrics" USING btree ("template_id","step_number","date");--> statement-breakpoint
CREATE UNIQUE INDEX "client_flow_period_idx" ON "client_flow_outcomes" USING btree ("client_id","flow_id","period");--> statement-breakpoint
CREATE INDEX "idx_knowledge_base_client_id" ON "knowledge_base" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_base_category" ON "knowledge_base" USING btree ("client_id","category");--> statement-breakpoint
CREATE INDEX "idx_cancellation_requests_client" ON "cancellation_requests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_cancellation_requests_status" ON "cancellation_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_jobs_client" ON "jobs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_status" ON "jobs" USING btree ("status");