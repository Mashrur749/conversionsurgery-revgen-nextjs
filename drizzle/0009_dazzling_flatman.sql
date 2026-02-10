CREATE TYPE "public"."consent_source" AS ENUM('web_form', 'text_optin', 'paper_form', 'phone_recording', 'existing_customer', 'manual_entry', 'api_import');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('express_written', 'express_oral', 'implied', 'transactional');--> statement-breakpoint
CREATE TYPE "public"."opt_out_reason" AS ENUM('stop_keyword', 'unsubscribe_link', 'manual_request', 'complaint', 'admin_removed', 'dnc_match', 'bounce');--> statement-breakpoint
CREATE TYPE "public"."agent_action" AS ENUM('respond', 'wait', 'trigger_flow', 'escalate', 'book_appointment', 'send_quote', 'request_photos', 'send_payment', 'close_won', 'close_lost');--> statement-breakpoint
CREATE TYPE "public"."escalation_reason" AS ENUM('explicit_request', 'frustrated_sentiment', 'legal_threat', 'repeated_objection', 'complex_technical', 'high_value_lead', 'negative_review_threat', 'pricing_negotiation', 'complaint', 'emergency', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('new', 'qualifying', 'nurturing', 'hot', 'objection', 'escalated', 'booked', 'lost');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('positive', 'neutral', 'negative', 'frustrated');--> statement-breakpoint
CREATE TYPE "public"."plan_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');--> statement-breakpoint
CREATE TABLE "compliance_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid,
	"event_type" text NOT NULL,
	"event_timestamp" timestamp DEFAULT now() NOT NULL,
	"phone_number" text,
	"phone_number_hash" text,
	"lead_id" uuid,
	"message_id" uuid,
	"consent_id" uuid,
	"event_data" jsonb,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"success" boolean NOT NULL,
	"error_message" text,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "compliance_check_cache" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"phone_number" text NOT NULL,
	"phone_number_hash" text NOT NULL,
	"has_valid_consent" boolean NOT NULL,
	"is_opted_out" boolean NOT NULL,
	"is_on_dnc" boolean NOT NULL,
	"can_receive_marketing" boolean NOT NULL,
	"can_receive_transactional" boolean NOT NULL,
	"last_checked_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consent_id" uuid,
	"opt_out_id" uuid
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"lead_id" uuid,
	"phone_number" text NOT NULL,
	"phone_number_hash" text NOT NULL,
	"consent_type" "consent_type" NOT NULL,
	"consent_source" "consent_source" NOT NULL,
	"consent_scope" jsonb NOT NULL,
	"consent_language" text NOT NULL,
	"consent_timestamp" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"form_url" text,
	"signature_image" text,
	"recording_url" text,
	"is_active" boolean DEFAULT true,
	"revoked_at" timestamp,
	"revoked_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "do_not_contact_list" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid,
	"phone_number" text NOT NULL,
	"phone_number_hash" text NOT NULL,
	"source" text NOT NULL,
	"source_reference" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"removed_at" timestamp,
	"remove_reason" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "opt_out_records" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"lead_id" uuid,
	"phone_number" text NOT NULL,
	"phone_number_hash" text NOT NULL,
	"opt_out_reason" "opt_out_reason" NOT NULL,
	"opt_out_timestamp" timestamp DEFAULT now() NOT NULL,
	"trigger_message" text,
	"trigger_message_id" uuid,
	"processed_at" timestamp,
	"processed_by" text,
	"reopted_in_at" timestamp,
	"reoptin_consent_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiet_hours_config" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"quiet_start_hour" integer DEFAULT 21 NOT NULL,
	"quiet_end_hour" integer DEFAULT 8 NOT NULL,
	"weekend_quiet_start_hour" integer,
	"weekend_quiet_end_hour" integer,
	"respect_federal_holidays" boolean DEFAULT true,
	"holiday_quiet_all_day" boolean DEFAULT false,
	"enforce_quiet_hours" boolean DEFAULT true,
	"queue_during_quiet_hours" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quiet_hours_config_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "lead_context" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"lead_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"stage" "lead_stage" DEFAULT 'new' NOT NULL,
	"previous_stage" "lead_stage",
	"stage_changed_at" timestamp DEFAULT now(),
	"urgency_score" integer DEFAULT 50,
	"budget_score" integer DEFAULT 50,
	"intent_score" integer DEFAULT 50,
	"current_sentiment" "sentiment" DEFAULT 'neutral',
	"sentiment_history" jsonb DEFAULT '[]'::jsonb,
	"project_type" varchar(100),
	"project_size" varchar(50),
	"estimated_value" integer,
	"preferred_timeframe" varchar(50),
	"property_type" varchar(50),
	"objections" jsonb DEFAULT '[]'::jsonb,
	"competitor_mentions" jsonb DEFAULT '[]'::jsonb,
	"total_messages" integer DEFAULT 0,
	"lead_messages" integer DEFAULT 0,
	"agent_messages" integer DEFAULT 0,
	"avg_response_time_seconds" integer,
	"booking_attempts" integer DEFAULT 0,
	"last_booking_attempt" timestamp,
	"quotes_sent" integer DEFAULT 0,
	"last_quote_amount" integer,
	"last_quote_sent_at" timestamp,
	"conversation_summary" text,
	"key_facts" jsonb DEFAULT '[]'::jsonb,
	"recommended_action" "agent_action",
	"recommended_action_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lead_context_lead_id_unique" UNIQUE("lead_id")
);
--> statement-breakpoint
CREATE TABLE "agent_decisions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"lead_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"message_id" uuid,
	"trigger_type" varchar(30) NOT NULL,
	"stage_at_decision" "lead_stage",
	"context_snapshot" jsonb,
	"action" "agent_action" NOT NULL,
	"action_details" jsonb,
	"reasoning" text,
	"confidence" integer,
	"alternatives_considered" jsonb,
	"outcome" varchar(30),
	"outcome_details" text,
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalation_queue" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"lead_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"reason" "escalation_reason" NOT NULL,
	"reason_details" text,
	"trigger_message_id" uuid,
	"priority" integer DEFAULT 3 NOT NULL,
	"conversation_summary" text,
	"suggested_response" text,
	"key_points" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"assigned_to" uuid,
	"assigned_at" timestamp,
	"resolved_at" timestamp,
	"resolved_by" uuid,
	"resolution" varchar(30),
	"resolution_notes" text,
	"return_to_ai" boolean DEFAULT true,
	"return_to_ai_after" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"first_response_at" timestamp,
	"sla_deadline" timestamp,
	"sla_breach" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "escalation_rules" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"conditions" jsonb NOT NULL,
	"action" jsonb NOT NULL,
	"enabled" boolean DEFAULT true,
	"priority" integer DEFAULT 100,
	"times_triggered" integer DEFAULT 0,
	"last_triggered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"lead_id" uuid NOT NULL,
	"message_index" integer NOT NULL,
	"checkpoint_at" timestamp DEFAULT now() NOT NULL,
	"summary" text NOT NULL,
	"extracted_data" jsonb,
	"stage_at_checkpoint" "lead_stage",
	"scores_at_checkpoint" jsonb,
	"token_count" integer
);
--> statement-breakpoint
CREATE TABLE "client_agent_settings" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"agent_name" varchar(50) DEFAULT 'Assistant',
	"agent_tone" varchar(30) DEFAULT 'professional',
	"max_response_length" integer DEFAULT 300,
	"use_emojis" boolean DEFAULT false,
	"sign_messages" boolean DEFAULT false,
	"auto_respond" boolean DEFAULT true,
	"respond_outside_hours" boolean DEFAULT true,
	"max_daily_messages_per_lead" integer DEFAULT 5,
	"min_time_between_messages" integer DEFAULT 60,
	"primary_goal" varchar(30) DEFAULT 'book_appointment',
	"booking_aggressiveness" integer DEFAULT 5,
	"max_booking_attempts" integer DEFAULT 3,
	"auto_escalate_after_messages" integer,
	"auto_escalate_on_negative_sentiment" boolean DEFAULT true,
	"auto_escalate_on_high_value" integer,
	"can_discuss_pricing" boolean DEFAULT false,
	"can_schedule_appointments" boolean DEFAULT true,
	"can_send_payment_links" boolean DEFAULT false,
	"quiet_hours_enabled" boolean DEFAULT true,
	"quiet_hours_start" time DEFAULT '21:00',
	"quiet_hours_end" time DEFAULT '08:00',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_agent_settings_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"description" text,
	"price_monthly" integer NOT NULL,
	"price_yearly" integer,
	"stripe_price_id_monthly" varchar(100),
	"stripe_price_id_yearly" varchar(100),
	"stripe_product_id" varchar(100),
	"features" jsonb NOT NULL,
	"trial_days" integer DEFAULT 14,
	"is_popular" boolean DEFAULT false,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"interval" "plan_interval" DEFAULT 'month' NOT NULL,
	"stripe_customer_id" varchar(100),
	"stripe_subscription_id" varchar(100),
	"stripe_price_id" varchar(100),
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false,
	"canceled_at" timestamp,
	"cancel_reason" text,
	"paused_at" timestamp,
	"resumes_at" timestamp,
	"discount_percent" integer,
	"discount_ends_at" timestamp,
	"coupon_code" varchar(50),
	"additional_leads_cents" integer DEFAULT 0,
	"additional_sms_cents" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "subscriptions_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "billing_payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"stripe_payment_method_id" varchar(100) NOT NULL,
	"type" varchar(20) DEFAULT 'card',
	"card_brand" varchar(20),
	"card_last4" varchar(4),
	"card_exp_month" integer,
	"card_exp_year" integer,
	"bank_name" varchar(100),
	"bank_last4" varchar(4),
	"is_default" boolean DEFAULT false,
	"billing_name" varchar(200),
	"billing_email" varchar(200),
	"billing_address" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_invoices" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"subscription_id" uuid,
	"stripe_invoice_id" varchar(100),
	"stripe_payment_intent_id" varchar(100),
	"invoice_number" varchar(50),
	"status" varchar(20) DEFAULT 'draft',
	"subtotal_cents" integer NOT NULL,
	"discount_cents" integer DEFAULT 0,
	"tax_cents" integer DEFAULT 0,
	"total_cents" integer NOT NULL,
	"amount_paid_cents" integer DEFAULT 0,
	"amount_due_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'usd',
	"line_items" jsonb DEFAULT '[]'::jsonb,
	"invoice_date" timestamp DEFAULT now(),
	"due_date" timestamp,
	"paid_at" timestamp,
	"period_start" timestamp,
	"period_end" timestamp,
	"pdf_url" text,
	"hosted_invoice_url" text,
	"payment_method_id" uuid,
	"payment_attempts" integer DEFAULT 0,
	"last_payment_error" text,
	"next_payment_attempt" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"subscription_id" uuid,
	"usage_type" varchar(50) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_amount_cents" integer,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"reported_to_stripe" boolean DEFAULT false,
	"stripe_usage_record_id" varchar(100),
	"billed_on_invoice_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"description" text,
	"subscription_id" uuid,
	"invoice_id" uuid,
	"payment_method_id" uuid,
	"amount_cents" integer,
	"stripe_event_id" varchar(100),
	"stripe_event_type" varchar(100),
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100),
	"discount_type" varchar(20) NOT NULL,
	"discount_value" integer NOT NULL,
	"duration" varchar(20) DEFAULT 'once',
	"duration_months" integer,
	"max_redemptions" integer,
	"times_redeemed" integer DEFAULT 0,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"applicable_plans" jsonb,
	"min_amount_cents" integer,
	"first_time_only" boolean DEFAULT false,
	"stripe_coupon_id" varchar(100),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "compliance_audit_log" ADD CONSTRAINT "compliance_audit_log_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_check_cache" ADD CONSTRAINT "compliance_check_cache_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_check_cache" ADD CONSTRAINT "compliance_check_cache_consent_id_consent_records_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."consent_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_check_cache" ADD CONSTRAINT "compliance_check_cache_opt_out_id_opt_out_records_id_fk" FOREIGN KEY ("opt_out_id") REFERENCES "public"."opt_out_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "do_not_contact_list" ADD CONSTRAINT "do_not_contact_list_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opt_out_records" ADD CONSTRAINT "opt_out_records_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opt_out_records" ADD CONSTRAINT "opt_out_records_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opt_out_records" ADD CONSTRAINT "opt_out_records_reoptin_consent_id_consent_records_id_fk" FOREIGN KEY ("reoptin_consent_id") REFERENCES "public"."consent_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiet_hours_config" ADD CONSTRAINT "quiet_hours_config_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_context" ADD CONSTRAINT "lead_context_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_context" ADD CONSTRAINT "lead_context_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_message_id_conversations_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_queue" ADD CONSTRAINT "escalation_queue_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_queue" ADD CONSTRAINT "escalation_queue_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_queue" ADD CONSTRAINT "escalation_queue_trigger_message_id_conversations_id_fk" FOREIGN KEY ("trigger_message_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_queue" ADD CONSTRAINT "escalation_queue_assigned_to_team_members_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_queue" ADD CONSTRAINT "escalation_queue_resolved_by_team_members_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_rules" ADD CONSTRAINT "escalation_rules_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_checkpoints" ADD CONSTRAINT "conversation_checkpoints_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_agent_settings" ADD CONSTRAINT "client_agent_settings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payment_methods" ADD CONSTRAINT "billing_payment_methods_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_payment_method_id_billing_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."billing_payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_billed_on_invoice_id_subscription_invoices_id_fk" FOREIGN KEY ("billed_on_invoice_id") REFERENCES "public"."subscription_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_invoice_id_subscription_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."subscription_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_payment_method_id_billing_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."billing_payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_client_event" ON "compliance_audit_log" USING btree ("client_id","event_type");--> statement-breakpoint
CREATE INDEX "idx_audit_timestamp" ON "compliance_audit_log" USING btree ("event_timestamp");--> statement-breakpoint
CREATE INDEX "idx_audit_phone_hash" ON "compliance_audit_log" USING btree ("phone_number_hash");--> statement-breakpoint
CREATE INDEX "idx_cache_client_phone" ON "compliance_check_cache" USING btree ("client_id","phone_number");--> statement-breakpoint
CREATE INDEX "idx_cache_expires" ON "compliance_check_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_consent_client_phone" ON "consent_records" USING btree ("client_id","phone_number");--> statement-breakpoint
CREATE INDEX "idx_consent_phone_hash" ON "consent_records" USING btree ("phone_number_hash");--> statement-breakpoint
CREATE INDEX "idx_consent_lead" ON "consent_records" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_consent_active" ON "consent_records" USING btree ("client_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_dnc_phone_hash" ON "do_not_contact_list" USING btree ("phone_number_hash");--> statement-breakpoint
CREATE INDEX "idx_dnc_client_phone" ON "do_not_contact_list" USING btree ("client_id","phone_number");--> statement-breakpoint
CREATE INDEX "idx_dnc_source" ON "do_not_contact_list" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_dnc_active" ON "do_not_contact_list" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_optout_client_phone" ON "opt_out_records" USING btree ("client_id","phone_number");--> statement-breakpoint
CREATE INDEX "idx_optout_phone_hash" ON "opt_out_records" USING btree ("phone_number_hash");--> statement-breakpoint
CREATE INDEX "idx_optout_timestamp" ON "opt_out_records" USING btree ("opt_out_timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_context_lead_idx" ON "lead_context" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_context_client_idx" ON "lead_context" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "lead_context_stage_idx" ON "lead_context" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "lead_context_intent_idx" ON "lead_context" USING btree ("intent_score");--> statement-breakpoint
CREATE INDEX "agent_decisions_lead_idx" ON "agent_decisions" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "agent_decisions_client_idx" ON "agent_decisions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "agent_decisions_action_idx" ON "agent_decisions" USING btree ("action");--> statement-breakpoint
CREATE INDEX "agent_decisions_created_idx" ON "agent_decisions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "escalation_queue_lead_idx" ON "escalation_queue" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "escalation_queue_client_idx" ON "escalation_queue" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "escalation_queue_status_idx" ON "escalation_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "escalation_queue_priority_idx" ON "escalation_queue" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "escalation_queue_assigned_idx" ON "escalation_queue" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "escalation_rules_client_idx" ON "escalation_rules" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "escalation_rules_enabled_idx" ON "escalation_rules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "conversation_checkpoints_lead_idx" ON "conversation_checkpoints" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "conversation_checkpoints_message_idx" ON "conversation_checkpoints" USING btree ("message_index");--> statement-breakpoint
CREATE INDEX "idx_plans_slug" ON "plans" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_plans_display_order" ON "plans" USING btree ("display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_client_idx" ON "subscriptions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "subscriptions_stripe_sub_idx" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_payment_methods_client_idx" ON "billing_payment_methods" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_payment_methods_stripe_idx" ON "billing_payment_methods" USING btree ("stripe_payment_method_id");--> statement-breakpoint
CREATE INDEX "subscription_invoices_client_idx" ON "subscription_invoices" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_invoices_stripe_idx" ON "subscription_invoices" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE INDEX "subscription_invoices_status_idx" ON "subscription_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscription_invoices_date_idx" ON "subscription_invoices" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "usage_records_client_period_idx" ON "usage_records" USING btree ("client_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "usage_records_type_idx" ON "usage_records" USING btree ("usage_type");--> statement-breakpoint
CREATE INDEX "billing_events_client_idx" ON "billing_events" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "billing_events_type_idx" ON "billing_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_events_stripe_idx" ON "billing_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "billing_events_created_idx" ON "billing_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_idx" ON "coupons" USING btree ("code");