CREATE TYPE "public"."media_type" AS ENUM('image', 'video', 'audio', 'document', 'other');--> statement-breakpoint
CREATE TYPE "public"."calendar_provider" AS ENUM('google', 'jobber', 'servicetitan', 'housecall_pro', 'outlook');--> statement-breakpoint
CREATE TABLE "media_attachments" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid,
	"lead_id" uuid,
	"message_id" uuid,
	"type" "media_type" NOT NULL,
	"mime_type" varchar(100),
	"file_name" varchar(255),
	"file_size" integer,
	"storage_key" varchar(500) NOT NULL,
	"public_url" varchar(1000),
	"thumbnail_key" varchar(500),
	"thumbnail_url" varchar(1000),
	"twilio_media_sid" varchar(50),
	"twilio_media_url" varchar(1000),
	"ai_description" text,
	"ai_tags" jsonb,
	"width" integer,
	"height" integer,
	"duration" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid,
	"invoice_id" uuid,
	"lead_id" uuid,
	"type" varchar(20) DEFAULT 'full',
	"amount" integer NOT NULL,
	"description" text,
	"stripe_payment_intent_id" varchar(100),
	"stripe_payment_link_id" varchar(100),
	"stripe_payment_link_url" varchar(500),
	"status" varchar(20) DEFAULT 'pending',
	"paid_at" timestamp,
	"link_sent_at" timestamp,
	"link_opened_at" timestamp,
	"link_expires_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_reminders" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"payment_id" uuid,
	"invoice_id" uuid,
	"reminder_number" integer DEFAULT 1,
	"sent_at" timestamp,
	"message_content" text,
	"lead_replied" boolean DEFAULT false,
	"reply_content" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"source" varchar(20) NOT NULL,
	"external_id" varchar(255),
	"external_url" varchar(1000),
	"author_name" varchar(255),
	"author_photo" varchar(1000),
	"rating" integer NOT NULL,
	"review_text" text,
	"has_response" boolean DEFAULT false,
	"response_text" text,
	"response_date" timestamp,
	"sentiment" varchar(20),
	"ai_suggested_response" text,
	"key_topics" jsonb,
	"alert_sent" boolean DEFAULT false,
	"alert_sent_at" timestamp,
	"matched_lead_id" uuid,
	"review_date" timestamp,
	"fetched_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_sources" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"source" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true,
	"google_place_id" varchar(255),
	"yelp_business_id" varchar(255),
	"facebook_page_id" varchar(255),
	"last_fetched_at" timestamp,
	"last_review_date" timestamp,
	"total_reviews" integer DEFAULT 0,
	"average_rating" real,
	"last_error" text,
	"consecutive_errors" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_metrics" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"period" varchar(20) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_reviews" integer DEFAULT 0,
	"average_rating" real,
	"five_star_count" integer DEFAULT 0,
	"four_star_count" integer DEFAULT 0,
	"three_star_count" integer DEFAULT 0,
	"two_star_count" integer DEFAULT 0,
	"one_star_count" integer DEFAULT 0,
	"google_count" integer DEFAULT 0,
	"yelp_count" integer DEFAULT 0,
	"positive_count" integer DEFAULT 0,
	"neutral_count" integer DEFAULT 0,
	"negative_count" integer DEFAULT 0,
	"responded_count" integer DEFAULT 0,
	"avg_response_time_hours" real,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "review_metrics_client_period_start" UNIQUE("client_id","period","period_start")
);
--> statement-breakpoint
CREATE TABLE "response_templates" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(50),
	"template_text" text NOT NULL,
	"variables" jsonb,
	"min_rating" integer,
	"max_rating" integer,
	"keywords" jsonb,
	"usage_count" integer DEFAULT 0,
	"last_used_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_responses" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"review_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"response_text" text NOT NULL,
	"response_type" varchar(20) DEFAULT 'ai_generated',
	"template_id" uuid,
	"status" varchar(20) DEFAULT 'draft',
	"submitted_at" timestamp,
	"submitted_by" uuid,
	"approved_at" timestamp,
	"approved_by" uuid,
	"rejection_reason" text,
	"posted_at" timestamp,
	"post_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calendar_integrations" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid,
	"provider" "calendar_provider" NOT NULL,
	"is_active" boolean DEFAULT true,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"external_account_id" varchar(255),
	"calendar_id" varchar(255),
	"sync_enabled" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"sync_direction" varchar(20) DEFAULT 'both',
	"last_error" text,
	"consecutive_errors" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid,
	"lead_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text,
	"location" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"is_all_day" boolean DEFAULT false,
	"timezone" varchar(50) DEFAULT 'America/Denver',
	"status" varchar(20) DEFAULT 'scheduled',
	"provider" "calendar_provider",
	"external_event_id" varchar(255),
	"last_synced_at" timestamp,
	"sync_status" varchar(20) DEFAULT 'pending',
	"assigned_team_member_id" uuid,
	"event_type" varchar(50),
	"job_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_calls" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"lead_id" uuid,
	"twilio_call_sid" varchar(50),
	"from_number" varchar(20) NOT NULL,
	"to_number" varchar(20) NOT NULL,
	"direction" varchar(10) DEFAULT 'inbound',
	"status" varchar(20),
	"duration" integer,
	"transcript" text,
	"ai_summary" text,
	"caller_intent" varchar(50),
	"caller_sentiment" varchar(20),
	"outcome" varchar(30),
	"callback_requested" boolean DEFAULT false,
	"callback_time" timestamp,
	"transferred_to" varchar(20),
	"recording_url" varchar(500),
	"recording_sid" varchar(50),
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"description" text,
	"price_monthly" integer NOT NULL,
	"price_yearly" integer NOT NULL,
	"stripe_price_id_monthly" varchar(255),
	"stripe_price_id_yearly" varchar(255),
	"stripe_product_id" varchar(255),
	"included_leads" integer DEFAULT 100,
	"included_messages" integer DEFAULT 1000,
	"included_team_members" integer DEFAULT 2,
	"included_phone_numbers" integer DEFAULT 1,
	"features" jsonb DEFAULT '[]'::jsonb,
	"sort_order" integer DEFAULT 0,
	"is_public" boolean DEFAULT true,
	"is_popular" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"password_hash" text NOT NULL,
	"role" varchar(50) DEFAULT 'admin',
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "google_access_token" varchar(500);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "google_refresh_token" varchar(500);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "google_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "google_business_account_id" varchar(100);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "google_location_id" varchar(100);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "missed_call_sms_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "ai_response_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "ai_agent_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "ai_agent_mode" varchar(20) DEFAULT 'assist';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "auto_escalation_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "flows_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "lead_scoring_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "calendar_sync_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "hot_transfer_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "payment_links_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "reputation_monitoring_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "auto_review_response_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "photo_requests_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "multi_language_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "preferred_language" varchar(10) DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "voice_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "voice_mode" varchar(20) DEFAULT 'after_hours';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "voice_greeting" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "voice_voice_id" varchar(100);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "voice_max_duration" integer DEFAULT 300;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "stripe_customer_id" varchar(100);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "job_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "total_amount" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "paid_amount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "remaining_amount" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "stripe_customer_id" varchar(100);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "media_attachments" ADD CONSTRAINT "media_attachments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_attachments" ADD CONSTRAINT "media_attachments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_attachments" ADD CONSTRAINT "media_attachments_message_id_conversations_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_matched_lead_id_leads_id_fk" FOREIGN KEY ("matched_lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_sources" ADD CONSTRAINT "review_sources_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_metrics" ADD CONSTRAINT "review_metrics_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_templates" ADD CONSTRAINT "response_templates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_template_id_response_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."response_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_integrations" ADD CONSTRAINT "calendar_integrations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_assigned_team_member_id_team_members_id_fk" FOREIGN KEY ("assigned_team_member_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_media_attachments_lead_id" ON "media_attachments" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_media_attachments_client_id" ON "media_attachments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_media_attachments_message_id" ON "media_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_payments_client" ON "payments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_payments_lead" ON "payments" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_payments_invoice" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payments_stripe_link" ON "payments" USING btree ("stripe_payment_link_id");--> statement-breakpoint
CREATE INDEX "idx_payment_reminders_payment" ON "payment_reminders" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_payment_reminders_invoice" ON "payment_reminders" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_reviews_client" ON "reviews" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_reviews_source" ON "reviews" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_reviews_date" ON "reviews" USING btree ("review_date");--> statement-breakpoint
CREATE INDEX "idx_review_sources_client" ON "review_sources" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_review_metrics_client" ON "review_metrics" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_response_templates_client" ON "response_templates" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_response_templates_category" ON "response_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_review_responses_review" ON "review_responses" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "idx_review_responses_client" ON "review_responses" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_review_responses_status" ON "review_responses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_calendar_integrations_client" ON "calendar_integrations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_integrations_provider" ON "calendar_integrations" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_client" ON "calendar_events" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_time" ON "calendar_events" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_external" ON "calendar_events" USING btree ("provider","external_event_id");--> statement-breakpoint
CREATE INDEX "idx_voice_calls_client_id" ON "voice_calls" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_voice_calls_lead_id" ON "voice_calls" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_voice_calls_call_sid" ON "voice_calls" USING btree ("twilio_call_sid");--> statement-breakpoint
CREATE INDEX "idx_subscription_plans_slug" ON "subscription_plans" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_subscription_plans_sort_order" ON "subscription_plans" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_admin_users_email" ON "admin_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_admin_users_role" ON "admin_users" USING btree ("role");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_invoices_client" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_lead" ON "invoices" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "invoices" USING btree ("status");