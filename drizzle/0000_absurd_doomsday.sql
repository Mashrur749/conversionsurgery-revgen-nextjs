CREATE TYPE "public"."api_service" AS ENUM('anthropic', 'twilio_sms', 'twilio_voice', 'twilio_phone', 'stripe', 'google_places', 'cloudflare_r2');--> statement-breakpoint
CREATE TYPE "public"."flow_approval" AS ENUM('auto', 'suggest', 'ask_sms');--> statement-breakpoint
CREATE TYPE "public"."flow_category" AS ENUM('missed_call', 'form_response', 'estimate', 'appointment', 'payment', 'review', 'referral', 'custom');--> statement-breakpoint
CREATE TYPE "public"."flow_sync_mode" AS ENUM('inherit', 'override', 'detached');--> statement-breakpoint
CREATE TYPE "public"."flow_trigger" AS ENUM('webhook', 'scheduled', 'manual', 'ai_suggested');--> statement-breakpoint
CREATE TYPE "public"."knowledge_category" AS ENUM('services', 'pricing', 'faq', 'policies', 'about', 'custom');--> statement-breakpoint
CREATE TYPE "public"."onboarding_milestone_status" AS ENUM('pending', 'completed', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."onboarding_sla_alert_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."revenue_leak_audit_status" AS ENUM('draft', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('lead', 'quoted', 'won', 'lost', 'completed');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('image', 'video', 'audio', 'document', 'other');--> statement-breakpoint
CREATE TYPE "public"."calendar_provider" AS ENUM('google', 'jobber', 'servicetitan', 'housecall_pro', 'outlook');--> statement-breakpoint
CREATE TYPE "public"."quarterly_campaign_status" AS ENUM('planned', 'scheduled', 'launched', 'completed');--> statement-breakpoint
CREATE TYPE "public"."quarterly_campaign_type" AS ENUM('dormant_reactivation', 'review_acceleration', 'pipeline_builder', 'year_end_strategy');--> statement-breakpoint
CREATE TYPE "public"."consent_source" AS ENUM('web_form', 'text_optin', 'paper_form', 'phone_recording', 'existing_customer', 'manual_entry', 'api_import');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('express_written', 'express_oral', 'implied', 'transactional');--> statement-breakpoint
CREATE TYPE "public"."opt_out_reason" AS ENUM('stop_keyword', 'unsubscribe_link', 'manual_request', 'complaint', 'admin_removed', 'dnc_match', 'bounce');--> statement-breakpoint
CREATE TYPE "public"."agent_action" AS ENUM('respond', 'wait', 'trigger_flow', 'escalate', 'book_appointment', 'send_quote', 'request_photos', 'send_payment', 'close_won', 'close_lost');--> statement-breakpoint
CREATE TYPE "public"."escalation_reason" AS ENUM('explicit_request', 'frustrated_sentiment', 'legal_threat', 'repeated_objection', 'complex_technical', 'high_value_lead', 'negative_review_threat', 'pricing_negotiation', 'complaint', 'emergency', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('new', 'qualifying', 'nurturing', 'hot', 'objection', 'escalated', 'booked', 'lost');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('positive', 'neutral', 'negative', 'frustrated');--> statement-breakpoint
CREATE TYPE "public"."plan_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" varchar(255) NOT NULL,
	"owner_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"twilio_number" varchar(20),
	"google_business_url" varchar(500),
	"google_access_token" varchar(500),
	"google_refresh_token" varchar(500),
	"google_token_expires_at" timestamp,
	"google_business_account_id" varchar(100),
	"google_location_id" varchar(100),
	"timezone" varchar(50) DEFAULT 'America/Edmonton',
	"missed_call_sms_enabled" boolean DEFAULT true,
	"ai_response_enabled" boolean DEFAULT true,
	"ai_agent_enabled" boolean DEFAULT true,
	"ai_agent_mode" varchar(20) DEFAULT 'assist',
	"auto_escalation_enabled" boolean DEFAULT true,
	"smart_assist_enabled" boolean DEFAULT true,
	"smart_assist_delay_minutes" integer DEFAULT 5,
	"smart_assist_manual_categories" jsonb DEFAULT '["estimate_followup","payment"]',
	"flows_enabled" boolean DEFAULT true,
	"lead_scoring_enabled" boolean DEFAULT true,
	"calendar_sync_enabled" boolean DEFAULT false,
	"hot_transfer_enabled" boolean DEFAULT false,
	"payment_links_enabled" boolean DEFAULT false,
	"reputation_monitoring_enabled" boolean DEFAULT false,
	"auto_review_response_enabled" boolean DEFAULT false,
	"photo_requests_enabled" boolean DEFAULT true,
	"multi_language_enabled" boolean DEFAULT false,
	"preferred_language" varchar(10) DEFAULT 'en',
	"notification_email" boolean DEFAULT true,
	"notification_sms" boolean DEFAULT true,
	"webhook_url" varchar(500),
	"webhook_events" jsonb DEFAULT '["lead.created", "lead.qualified", "appointment.booked"]',
	"reminder_routing_policy" jsonb DEFAULT '{
        "appointment_reminder_contractor": {
          "primaryRole": "owner",
          "fallbackRoles": ["assistant", "escalation_team"],
          "secondaryRoles": []
        },
        "booking_notification": {
          "primaryRole": "owner",
          "fallbackRoles": ["assistant", "escalation_team"],
          "secondaryRoles": []
        }
      }'::jsonb,
	"messages_sent_this_month" integer DEFAULT 0,
	"monthly_message_limit" integer DEFAULT 500,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"status" varchar(20) DEFAULT 'active',
	"weekly_summary_enabled" boolean DEFAULT true,
	"weekly_summary_day" integer DEFAULT 1,
	"weekly_summary_time" varchar(5) DEFAULT '08:00',
	"last_weekly_summary_at" timestamp,
	"is_test" boolean DEFAULT false,
	"voice_enabled" boolean DEFAULT false,
	"voice_mode" varchar(20) DEFAULT 'after_hours',
	"voice_greeting" text,
	"voice_voice_id" varchar(100),
	"voice_max_duration" integer DEFAULT 300,
	"previous_response_time_minutes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clients_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(255),
	"phone" varchar(20) NOT NULL,
	"email" varchar(255),
	"address" varchar(500),
	"project_type" varchar(255),
	"notes" text,
	"source" varchar(50),
	"status" varchar(50) DEFAULT 'new',
	"action_required" boolean DEFAULT false,
	"action_required_reason" varchar(255),
	"conversation_mode" varchar(10) DEFAULT 'ai',
	"human_takeover_at" timestamp,
	"human_takeover_by" varchar(255),
	"score" integer DEFAULT 50,
	"score_updated_at" timestamp,
	"score_factors" jsonb,
	"temperature" varchar(10) DEFAULT 'warm',
	"confirmed_revenue" integer,
	"stripe_customer_id" varchar(100),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"opted_out" boolean DEFAULT false,
	"opted_out_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leads_client_phone_unique" UNIQUE("client_id","phone")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"direction" varchar(10),
	"message_type" varchar(20),
	"content" text NOT NULL,
	"twilio_sid" varchar(50),
	"ai_confidence" numeric(3, 2),
	"delivery_status" varchar(20),
	"media_url" jsonb,
	"flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" varchar(30),
	"flag_note" text,
	"flagged_by" uuid,
	"flagged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scheduled_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"sequence_type" varchar(50),
	"sequence_step" integer,
	"content" text NOT NULL,
	"send_at" timestamp NOT NULL,
	"sent" boolean DEFAULT false,
	"sent_at" timestamp,
	"cancelled" boolean DEFAULT false,
	"cancelled_at" timestamp,
	"cancelled_reason" varchar(255),
	"assist_status" varchar(40),
	"assist_category" varchar(40),
	"assist_requires_manual" boolean DEFAULT false,
	"assist_original_content" text,
	"assist_reference_code" varchar(12),
	"assist_notified_at" timestamp,
	"assist_resolved_at" timestamp,
	"assist_resolution_source" varchar(40),
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"appointment_date" date NOT NULL,
	"appointment_time" time NOT NULL,
	"address" varchar(500),
	"status" varchar(20) DEFAULT 'scheduled',
	"reminder_day_before_sent" boolean DEFAULT false,
	"reminder_2hr_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"job_id" uuid,
	"invoice_number" varchar(50),
	"description" text,
	"amount" numeric(10, 2),
	"total_amount" integer,
	"paid_amount" integer DEFAULT 0,
	"remaining_amount" integer,
	"due_date" date,
	"status" varchar(20) DEFAULT 'pending',
	"payment_link" varchar(500),
	"stripe_customer_id" varchar(100),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocked_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"phone" varchar(20) NOT NULL,
	"reason" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_numbers_client_phone_unique" UNIQUE("client_id","phone")
);
--> statement-breakpoint
CREATE TABLE "error_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"error_type" varchar(100),
	"error_message" text,
	"error_details" jsonb,
	"resolved" boolean DEFAULT false,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"event_type" varchar(50),
	"payload" jsonb,
	"response_status" integer,
	"response_body" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"template_type" varchar(50),
	"template_variant_id" uuid,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "message_templates_client_type_unique" UNIQUE("client_id","template_type")
);
--> statement-breakpoint
CREATE TABLE "daily_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"date" date NOT NULL,
	"missed_calls_captured" integer DEFAULT 0,
	"forms_responded" integer DEFAULT 0,
	"conversations_started" integer DEFAULT 0,
	"appointments_reminded" integer DEFAULT 0,
	"estimates_followed_up" integer DEFAULT 0,
	"reviews_requested" integer DEFAULT 0,
	"referrals_requested" integer DEFAULT 0,
	"payments_reminded" integer DEFAULT 0,
	"messages_sent" integer DEFAULT 0,
	"smart_assist_pending" integer DEFAULT 0,
	"smart_assist_auto_sent" integer DEFAULT 0,
	"smart_assist_approved_sent" integer DEFAULT 0,
	"smart_assist_cancelled" integer DEFAULT 0,
	"ai_messages_flagged" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_stats_client_date_unique" UNIQUE("client_id","date")
);
--> statement-breakpoint
CREATE TABLE "active_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_sid" varchar(100) NOT NULL,
	"client_id" uuid NOT NULL,
	"caller_phone" varchar(20) NOT NULL,
	"twilio_number" varchar(20) NOT NULL,
	"received_at" timestamp NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalation_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"claimed_by" uuid,
	"claim_token" varchar(64) NOT NULL,
	"escalation_reason" varchar(255),
	"last_lead_message" text,
	"status" varchar(20) DEFAULT 'pending',
	"notified_at" timestamp DEFAULT now() NOT NULL,
	"claimed_at" timestamp,
	"resolved_at" timestamp,
	"re_notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "escalation_claims_claim_token_unique" UNIQUE("claim_token")
);
--> statement-breakpoint
CREATE TABLE "business_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"open_time" time,
	"close_time" time,
	"is_open" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"call_sid" varchar(50),
	"status" varchar(20),
	"answered_by" uuid,
	"duration" integer,
	"recording_url" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"answered_at" timestamp,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ab_test_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"date" varchar(10) NOT NULL,
	"variant" varchar(1) NOT NULL,
	"messages_sent" integer DEFAULT 0,
	"messages_delivered" integer DEFAULT 0,
	"conversations_started" integer DEFAULT 0,
	"appointments_booked" integer DEFAULT 0,
	"forms_responded" integer DEFAULT 0,
	"leads_qualified" integer DEFAULT 0,
	"estimates_followed_up" integer DEFAULT 0,
	"conversions_completed" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ab_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"test_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'active',
	"variant_a" jsonb NOT NULL,
	"variant_b" jsonb NOT NULL,
	"winner" varchar(1),
	"start_date" timestamp DEFAULT now(),
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"report_type" varchar(50) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"metrics" jsonb NOT NULL,
	"performance_data" jsonb,
	"test_results" jsonb,
	"team_performance" jsonb,
	"roi_summary" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"report_id" uuid,
	"report_type" varchar(50) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"channel" varchar(20) DEFAULT 'email' NOT NULL,
	"recipient" text,
	"state" varchar(20) DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"channel_metadata" jsonb,
	"last_error_code" varchar(100),
	"last_error_message" text,
	"generated_at" timestamp,
	"queued_at" timestamp,
	"sent_at" timestamp,
	"failed_at" timestamp,
	"retried_at" timestamp,
	"last_state_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_delivery_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"from_state" varchar(20),
	"to_state" varchar(20) NOT NULL,
	"error_code" varchar(100),
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "template_variants_type_name_unique" UNIQUE("template_type","name")
);
--> statement-breakpoint
CREATE TABLE "template_performance_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_variant_id" uuid NOT NULL,
	"date_collected" date NOT NULL,
	"period" varchar(10) NOT NULL,
	"total_executions" integer DEFAULT 0,
	"total_delivered" integer DEFAULT 0,
	"total_conversations_started" integer DEFAULT 0,
	"total_appointments_reminded" integer DEFAULT 0,
	"total_estimates_followed_up" integer DEFAULT 0,
	"total_forms_responded" integer DEFAULT 0,
	"total_leads_qualified" integer DEFAULT 0,
	"total_revenue_recovered" numeric(12, 2),
	"delivery_rate" numeric(5, 4) DEFAULT '0',
	"engagement_rate" numeric(5, 4) DEFAULT '0',
	"conversion_rate" numeric(5, 4) DEFAULT '0',
	"avg_response_time" integer,
	"clients_using_variant" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"service" "api_service" NOT NULL,
	"operation" varchar(50) NOT NULL,
	"model" varchar(50),
	"input_tokens" integer,
	"output_tokens" integer,
	"units" integer DEFAULT 1 NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"anthropic_cost_cents" integer DEFAULT 0 NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"alert_type" varchar(30) NOT NULL,
	"severity" varchar(10) NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp,
	"acknowledged_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "magic_link_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20),
	"email" varchar(255),
	"client_id" uuid,
	"person_id" uuid,
	"code" varchar(6) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_template_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid,
	"step_number" integer NOT NULL,
	"name" varchar(100),
	"delay_minutes" integer DEFAULT 0,
	"message_template" text NOT NULL,
	"skip_conditions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid,
	"version" integer NOT NULL,
	"snapshot" jsonb,
	"change_notes" text,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"published_by" uuid
);
--> statement-breakpoint
CREATE TABLE "flow_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "flow_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "flow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flow_id" uuid,
	"lead_id" uuid,
	"client_id" uuid,
	"status" varchar(20) DEFAULT 'active',
	"current_step" integer DEFAULT 1,
	"total_steps" integer,
	"started_at" timestamp DEFAULT now() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"client_id" uuid,
	"flow_id" uuid,
	"detected_signal" varchar(100),
	"confidence" integer,
	"reason" text,
	"trigger_message_id" uuid,
	"status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"responded_at" timestamp,
	"responded_by" varchar(255),
	"flow_execution_id" uuid
);
--> statement-breakpoint
CREATE TABLE "template_metrics_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_step_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid,
	"step_number" integer NOT NULL,
	"date" date NOT NULL,
	"messages_sent" integer DEFAULT 0,
	"responses_received" integer DEFAULT 0,
	"skipped" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_flow_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"flow_id" uuid,
	"period" varchar(10) NOT NULL,
	"leads_contacted" integer DEFAULT 0,
	"leads_responded" integer DEFAULT 0,
	"conversions" integer DEFAULT 0,
	"revenue" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_base" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"category" "knowledge_category" NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"keywords" text,
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_gaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"question" text NOT NULL,
	"category" text,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"confidence_level" text NOT NULL,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"owner_person_id" uuid,
	"due_at" timestamp,
	"priority_score" integer DEFAULT 0 NOT NULL,
	"review_required" boolean DEFAULT false NOT NULL,
	"resolution_note" text,
	"resolved_by_kb_id" uuid,
	"resolved_by_person_id" uuid,
	"resolved_at" timestamp,
	"verified_by_person_id" uuid,
	"verified_at" timestamp,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"sms_new_lead" boolean DEFAULT true NOT NULL,
	"sms_escalation" boolean DEFAULT true NOT NULL,
	"sms_weekly_summary" boolean DEFAULT true NOT NULL,
	"sms_flow_approval" boolean DEFAULT true NOT NULL,
	"sms_negative_review" boolean DEFAULT true NOT NULL,
	"email_new_lead" boolean DEFAULT false NOT NULL,
	"email_daily_summary" boolean DEFAULT false NOT NULL,
	"email_weekly_summary" boolean DEFAULT true NOT NULL,
	"email_monthly_report" boolean DEFAULT true NOT NULL,
	"quiet_hours_enabled" boolean DEFAULT false NOT NULL,
	"quiet_hours_start" varchar(5) DEFAULT '22:00' NOT NULL,
	"quiet_hours_end" varchar(5) DEFAULT '07:00' NOT NULL,
	"urgent_override" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "cancellation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"reason" text,
	"feedback" text,
	"value_shown" jsonb,
	"scheduled_call_at" timestamp,
	"grace_period_ends" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"processed_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "data_export_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"cancellation_request_id" uuid,
	"status" varchar(20) DEFAULT 'requested' NOT NULL,
	"requested_by" varchar(100) DEFAULT 'client_portal' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"due_at" timestamp NOT NULL,
	"started_at" timestamp,
	"ready_at" timestamp,
	"delivered_at" timestamp,
	"failed_at" timestamp,
	"failure_reason" text,
	"download_token" varchar(120),
	"download_token_expires_at" timestamp,
	"artifact_summary" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_milestone_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"milestone_id" uuid,
	"event_type" varchar(80) NOT NULL,
	"actor_type" varchar(30) DEFAULT 'system' NOT NULL,
	"actor_id" varchar(120),
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"milestone_key" varchar(80) NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" "onboarding_milestone_status" DEFAULT 'pending' NOT NULL,
	"target_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"completed_by" varchar(120),
	"evidence" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_onboarding_milestones_client_key" UNIQUE("client_id","milestone_key")
);
--> statement-breakpoint
CREATE TABLE "onboarding_sla_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"milestone_id" uuid,
	"milestone_key" varchar(80) NOT NULL,
	"status" "onboarding_sla_alert_status" DEFAULT 'open' NOT NULL,
	"reason" text NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_leak_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"status" "revenue_leak_audit_status" DEFAULT 'draft' NOT NULL,
	"summary" text,
	"findings" jsonb,
	"estimated_impact_low_cents" integer,
	"estimated_impact_base_cents" integer,
	"estimated_impact_high_cents" integer,
	"artifact_url" text,
	"delivered_at" timestamp,
	"delivered_by" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "revenue_leak_audits_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "onboarding_quality_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"allow_autonomous_mode" boolean DEFAULT true NOT NULL,
	"reason" text NOT NULL,
	"approved_by_person_id" uuid,
	"approved_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_quality_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"source" varchar(40) DEFAULT 'system' NOT NULL,
	"policy_mode" varchar(20) DEFAULT 'enforce' NOT NULL,
	"evaluated_by_person_id" uuid,
	"total_score" integer DEFAULT 0 NOT NULL,
	"max_score" integer DEFAULT 0 NOT NULL,
	"passed_critical" boolean DEFAULT false NOT NULL,
	"passed_all" boolean DEFAULT false NOT NULL,
	"gate_results" jsonb NOT NULL,
	"critical_failures" jsonb,
	"recommended_actions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(100),
	"avg_value_cents" integer,
	"price_range_min_cents" integer,
	"price_range_max_cents" integer,
	"can_discuss_price" varchar(20) DEFAULT 'defer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"client_id" uuid,
	"service_id" uuid,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"client_id" uuid,
	"event_type" varchar(50) NOT NULL,
	"amount" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"message_id" uuid,
	"type" "media_type" NOT NULL,
	"mime_type" varchar(100) NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid,
	"invoice_id" uuid,
	"reminder_number" integer DEFAULT 1,
	"sent_at" timestamp,
	"message_content" text,
	"lead_replied" boolean DEFAULT false,
	"reply_content" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_metrics_client_period_start" UNIQUE("client_id","period","period_start")
);
--> statement-breakpoint
CREATE TABLE "response_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"provider" "calendar_provider" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"external_account_id" varchar(255),
	"calendar_id" varchar(255),
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp,
	"sync_direction" varchar(20) DEFAULT 'both' NOT NULL,
	"last_error" text,
	"consecutive_errors" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"lead_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text,
	"location" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"is_all_day" boolean DEFAULT false NOT NULL,
	"timezone" varchar(50) DEFAULT 'America/Denver' NOT NULL,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"provider" "calendar_provider",
	"external_event_id" varchar(255),
	"last_synced_at" timestamp,
	"sync_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"assigned_team_member_id" uuid,
	"event_type" varchar(50),
	"job_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "agency_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"direction" varchar(10) NOT NULL,
	"channel" varchar(10) NOT NULL,
	"content" text NOT NULL,
	"subject" varchar(255),
	"category" varchar(30) NOT NULL,
	"prompt_type" varchar(30),
	"action_payload" jsonb,
	"action_status" varchar(20),
	"in_reply_to" uuid,
	"client_reply" text,
	"twilio_sid" varchar(50),
	"delivered" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "quarterly_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"quarter_key" varchar(7) NOT NULL,
	"campaign_type" "quarterly_campaign_type" NOT NULL,
	"status" "quarterly_campaign_status" DEFAULT 'planned' NOT NULL,
	"scheduled_at" timestamp,
	"launched_at" timestamp,
	"completed_at" timestamp,
	"plan_notes" text,
	"outcome_summary" text,
	"required_assets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_assets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quarterly_campaigns_client_quarter_unique" UNIQUE("client_id","quarter_key")
);
--> statement-breakpoint
CREATE TABLE "cron_job_cursors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_key" varchar(100) NOT NULL,
	"period_type" varchar(20) NOT NULL,
	"last_successful_period" date,
	"last_run_at" timestamp,
	"last_success_at" timestamp,
	"status" varchar(20) DEFAULT 'idle' NOT NULL,
	"backlog_count" integer DEFAULT 0 NOT NULL,
	"last_error_message" text,
	"last_error_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cron_job_cursors_job_key_unique" UNIQUE("job_key")
);
--> statement-breakpoint
CREATE TABLE "compliance_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"is_active" boolean DEFAULT true NOT NULL,
	"revoked_at" timestamp,
	"revoked_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "do_not_contact_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"phone_number" text NOT NULL,
	"phone_number_hash" text NOT NULL,
	"source" text NOT NULL,
	"source_reference" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"removed_at" timestamp,
	"remove_reason" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "opt_out_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"quiet_start_hour" integer DEFAULT 21 NOT NULL,
	"quiet_end_hour" integer DEFAULT 10 NOT NULL,
	"weekend_quiet_start_hour" integer,
	"weekend_quiet_end_hour" integer,
	"respect_federal_holidays" boolean DEFAULT true NOT NULL,
	"holiday_quiet_all_day" boolean DEFAULT false NOT NULL,
	"enforce_quiet_hours" boolean DEFAULT true NOT NULL,
	"queue_during_quiet_hours" boolean DEFAULT true NOT NULL,
	"policy_mode_override" varchar(40),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quiet_hours_config_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "lead_context" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"matched_service_id" uuid,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"guarantee_start_at" timestamp,
	"guarantee_ends_at" timestamp,
	"guarantee_status" varchar(40) DEFAULT 'proof_pending',
	"guarantee_proof_start_at" timestamp,
	"guarantee_proof_ends_at" timestamp,
	"guarantee_recovery_start_at" timestamp,
	"guarantee_recovery_ends_at" timestamp,
	"guarantee_adjusted_proof_ends_at" timestamp,
	"guarantee_adjusted_recovery_ends_at" timestamp,
	"guarantee_observed_monthly_lead_average" integer,
	"guarantee_extension_factor_basis_points" integer DEFAULT 10000,
	"guarantee_proof_qualified_lead_engagements" integer DEFAULT 0,
	"guarantee_recovery_attributed_opportunities" integer DEFAULT 0,
	"guarantee_fulfilled_at" timestamp,
	"guarantee_recovered_lead_id" uuid,
	"guarantee_refund_eligible_at" timestamp,
	"guarantee_refunded_at" timestamp,
	"guarantee_notes" text,
	"additional_leads_cents" integer DEFAULT 0,
	"additional_sms_cents" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "billing_payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"description" text,
	"subscription_id" uuid,
	"invoice_id" uuid,
	"payment_method_id" uuid,
	"amount_cents" integer,
	"stripe_event_id" varchar(100),
	"stripe_event_type" varchar(100),
	"idempotency_key" varchar(200),
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addon_billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"addon_type" varchar(40) NOT NULL,
	"source_type" varchar(40) NOT NULL,
	"source_ref" text,
	"invoice_id" uuid,
	"invoice_line_item_ref" varchar(160),
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"dispute_status" varchar(20) DEFAULT 'none' NOT NULL,
	"dispute_note" text,
	"disputed_at" timestamp,
	"resolved_at" timestamp,
	"resolved_by" varchar(120),
	"idempotency_key" varchar(160) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "analytics_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"event_data" jsonb,
	"value_cents" integer,
	"source" varchar(50),
	"campaign" varchar(100),
	"agent_decision_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_cohorts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"user_email" varchar(255) NOT NULL,
	"page" varchar(500) NOT NULL,
	"message" text NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "support_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"support_message_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"author_email" varchar(255) NOT NULL,
	"calcom_link" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "help_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"content" text NOT NULL,
	"category" varchar(100),
	"sort_order" integer DEFAULT 0,
	"is_published" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "help_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "nps_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"appointment_id" uuid,
	"score" integer,
	"comment" text,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp,
	"sent_via" varchar(10) DEFAULT 'sms',
	"status" varchar(20) DEFAULT 'sent',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"html_body" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"label" varchar(255) NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"key_prefix" varchar(8) NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_phone_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"friendly_name" varchar(100),
	"is_primary" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"capabilities" jsonb,
	"purchased_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "accounts_provider_provider_account_id_unique" UNIQUE("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp,
	"image" varchar(500),
	"person_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token"),
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"avatar_url" varchar(500),
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "people_has_identifier" CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "role_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"scope" varchar(20) NOT NULL,
	"permissions" text[] NOT NULL,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "client_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"role_template_id" uuid NOT NULL,
	"permission_overrides" jsonb,
	"is_owner" boolean DEFAULT false NOT NULL,
	"receive_escalations" boolean DEFAULT false NOT NULL,
	"receive_hot_transfers" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_memberships_person_client_unique" UNIQUE("person_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "agency_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"role_template_id" uuid NOT NULL,
	"client_scope" varchar(20) DEFAULT 'all' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agency_memberships_person_id_unique" UNIQUE("person_id")
);
--> statement-breakpoint
CREATE TABLE "agency_client_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_membership_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "aca_membership_client_unique" UNIQUE("agency_membership_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid,
	"client_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(50),
	"resource_id" uuid,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"session_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roi_calculator_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"business_name" text NOT NULL,
	"phone" varchar(20),
	"trade" varchar(100),
	"monthly_estimates" integer,
	"avg_project_value" numeric(12, 2),
	"current_close_rate" numeric(5, 2),
	"response_time" varchar(50),
	"after_hours_percent" numeric(5, 2),
	"follow_up_consistency" varchar(50),
	"follow_up_touches" integer,
	"hours_per_week" numeric(5, 1),
	"hourly_value" numeric(8, 2),
	"lost_revenue_annual" numeric(14, 2),
	"potential_revenue_annual" numeric(14, 2),
	"projected_roi" numeric(8, 2),
	"utm_source" varchar(255),
	"utm_medium" varchar(255),
	"utm_campaign" varchar(255),
	"referrer" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_flagged_by_people_id_fk" FOREIGN KEY ("flagged_by") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_numbers" ADD CONSTRAINT "blocked_numbers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_log" ADD CONSTRAINT "error_log_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_log" ADD CONSTRAINT "webhook_log_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_template_variant_id_template_variants_id_fk" FOREIGN KEY ("template_variant_id") REFERENCES "public"."template_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_calls" ADD CONSTRAINT "active_calls_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_claims" ADD CONSTRAINT "escalation_claims_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_claims" ADD CONSTRAINT "escalation_claims_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_claims" ADD CONSTRAINT "escalation_claims_claimed_by_client_memberships_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."client_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_answered_by_client_memberships_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."client_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ab_test_metrics" ADD CONSTRAINT "ab_test_metrics_test_id_ab_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."ab_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ab_tests" ADD CONSTRAINT "ab_tests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_delivery_events" ADD CONSTRAINT "report_delivery_events_delivery_id_report_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."report_deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_performance_metrics" ADD CONSTRAINT "template_performance_metrics_template_variant_id_template_variants_id_fk" FOREIGN KEY ("template_variant_id") REFERENCES "public"."template_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_daily" ADD CONSTRAINT "api_usage_daily_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_monthly" ADD CONSTRAINT "api_usage_monthly_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_alerts" ADD CONSTRAINT "usage_alerts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "knowledge_gaps" ADD CONSTRAINT "knowledge_gaps_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_gaps" ADD CONSTRAINT "knowledge_gaps_owner_person_id_people_id_fk" FOREIGN KEY ("owner_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_gaps" ADD CONSTRAINT "knowledge_gaps_resolved_by_kb_id_knowledge_base_id_fk" FOREIGN KEY ("resolved_by_kb_id") REFERENCES "public"."knowledge_base"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_gaps" ADD CONSTRAINT "knowledge_gaps_resolved_by_person_id_people_id_fk" FOREIGN KEY ("resolved_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_gaps" ADD CONSTRAINT "knowledge_gaps_verified_by_person_id_people_id_fk" FOREIGN KEY ("verified_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_cancellation_request_id_cancellation_requests_id_fk" FOREIGN KEY ("cancellation_request_id") REFERENCES "public"."cancellation_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_milestone_activities" ADD CONSTRAINT "onboarding_milestone_activities_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_milestone_activities" ADD CONSTRAINT "onboarding_milestone_activities_milestone_id_onboarding_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."onboarding_milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_milestones" ADD CONSTRAINT "onboarding_milestones_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_sla_alerts" ADD CONSTRAINT "onboarding_sla_alerts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_sla_alerts" ADD CONSTRAINT "onboarding_sla_alerts_milestone_id_onboarding_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."onboarding_milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_leak_audits" ADD CONSTRAINT "revenue_leak_audits_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_quality_overrides" ADD CONSTRAINT "onboarding_quality_overrides_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_quality_overrides" ADD CONSTRAINT "onboarding_quality_overrides_approved_by_person_id_people_id_fk" FOREIGN KEY ("approved_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_quality_snapshots" ADD CONSTRAINT "onboarding_quality_snapshots_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_quality_snapshots" ADD CONSTRAINT "onboarding_quality_snapshots_evaluated_by_person_id_people_id_fk" FOREIGN KEY ("evaluated_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_services" ADD CONSTRAINT "client_services_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_service_id_client_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."client_services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_assigned_team_member_id_client_memberships_id_fk" FOREIGN KEY ("assigned_team_member_id") REFERENCES "public"."client_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_messages" ADD CONSTRAINT "agency_messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quarterly_campaigns" ADD CONSTRAINT "quarterly_campaigns_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quarterly_campaigns" ADD CONSTRAINT "quarterly_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quarterly_campaigns" ADD CONSTRAINT "quarterly_campaigns_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "lead_context" ADD CONSTRAINT "lead_context_matched_service_id_client_services_id_fk" FOREIGN KEY ("matched_service_id") REFERENCES "public"."client_services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_message_id_conversations_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_queue" ADD CONSTRAINT "escalation_queue_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_queue" ADD CONSTRAINT "escalation_queue_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_queue" ADD CONSTRAINT "escalation_queue_trigger_message_id_conversations_id_fk" FOREIGN KEY ("trigger_message_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_queue" ADD CONSTRAINT "escalation_queue_assigned_to_client_memberships_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."client_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_queue" ADD CONSTRAINT "escalation_queue_resolved_by_client_memberships_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."client_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_rules" ADD CONSTRAINT "escalation_rules_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_checkpoints" ADD CONSTRAINT "conversation_checkpoints_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_agent_settings" ADD CONSTRAINT "client_agent_settings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payment_methods" ADD CONSTRAINT "billing_payment_methods_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_payment_method_id_billing_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."billing_payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_billed_on_invoice_id_subscription_invoices_id_fk" FOREIGN KEY ("billed_on_invoice_id") REFERENCES "public"."subscription_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_invoice_id_subscription_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."subscription_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_payment_method_id_billing_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."billing_payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_billing_events" ADD CONSTRAINT "addon_billing_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_billing_events" ADD CONSTRAINT "addon_billing_events_invoice_id_subscription_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."subscription_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_weekly" ADD CONSTRAINT "analytics_weekly_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_monthly" ADD CONSTRAINT "analytics_monthly_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_agent_decision_id_agent_decisions_id_fk" FOREIGN KEY ("agent_decision_id") REFERENCES "public"."agent_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_cohorts" ADD CONSTRAINT "client_cohorts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_replies" ADD CONSTRAINT "support_replies_support_message_id_support_messages_id_fk" FOREIGN KEY ("support_message_id") REFERENCES "public"."support_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_surveys" ADD CONSTRAINT "nps_surveys_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_surveys" ADD CONSTRAINT "nps_surveys_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_surveys" ADD CONSTRAINT "nps_surveys_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_phone_numbers" ADD CONSTRAINT "client_phone_numbers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_role_template_id_role_templates_id_fk" FOREIGN KEY ("role_template_id") REFERENCES "public"."role_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_invited_by_people_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_memberships" ADD CONSTRAINT "agency_memberships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_memberships" ADD CONSTRAINT "agency_memberships_role_template_id_role_templates_id_fk" FOREIGN KEY ("role_template_id") REFERENCES "public"."role_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_memberships" ADD CONSTRAINT "agency_memberships_invited_by_people_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_client_assignments" ADD CONSTRAINT "agency_client_assignments_agency_membership_id_agency_memberships_id_fk" FOREIGN KEY ("agency_membership_id") REFERENCES "public"."agency_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_client_assignments" ADD CONSTRAINT "agency_client_assignments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_clients_status" ON "clients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_leads_client_id" ON "leads" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_leads_phone" ON "leads" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_leads_status" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_leads_action_required" ON "leads" USING btree ("action_required") WHERE "leads"."action_required" = true;--> statement-breakpoint
CREATE INDEX "idx_conversations_lead_id" ON "conversations" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_client_id" ON "conversations" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_conversations_twilio_sid" ON "conversations" USING btree ("twilio_sid") WHERE twilio_sid IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_conversations_flagged" ON "conversations" USING btree ("flagged") WHERE flagged = true;--> statement-breakpoint
CREATE INDEX "idx_scheduled_messages_send_at" ON "scheduled_messages" USING btree ("send_at") WHERE "scheduled_messages"."sent" = false AND "scheduled_messages"."cancelled" = false;--> statement-breakpoint
CREATE INDEX "idx_scheduled_messages_client_id" ON "scheduled_messages" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_messages_lead_id" ON "scheduled_messages" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_messages_assist_status" ON "scheduled_messages" USING btree ("assist_status","send_at") WHERE "scheduled_messages"."assist_status" = 'pending_approval' AND "scheduled_messages"."sent" = false AND "scheduled_messages"."cancelled" = false;--> statement-breakpoint
CREATE INDEX "idx_scheduled_messages_assist_reference" ON "scheduled_messages" USING btree ("client_id","assist_reference_code");--> statement-breakpoint
CREATE INDEX "idx_appointments_date" ON "appointments" USING btree ("appointment_date");--> statement-breakpoint
CREATE INDEX "idx_appointments_client_id" ON "appointments" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_appointments_client_date_time" ON "appointments" USING btree ("client_id","appointment_date","appointment_time") WHERE status != 'cancelled';--> statement-breakpoint
CREATE INDEX "idx_invoices_client" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_lead" ON "invoices" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_blocked_numbers_phone" ON "blocked_numbers" USING btree ("client_id","phone");--> statement-breakpoint
CREATE INDEX "idx_webhook_log_client_event" ON "webhook_log" USING btree ("client_id","event_type");--> statement-breakpoint
CREATE INDEX "idx_webhook_log_created_at" ON "webhook_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_daily_stats_client_date" ON "daily_stats" USING btree ("client_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_active_calls_call_sid" ON "active_calls" USING btree ("call_sid");--> statement-breakpoint
CREATE INDEX "idx_active_calls_client_id" ON "active_calls" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_active_calls_received_at" ON "active_calls" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_active_calls_processed" ON "active_calls" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "idx_escalation_claims_lead_id" ON "escalation_claims" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_escalation_claims_token" ON "escalation_claims" USING btree ("claim_token");--> statement-breakpoint
CREATE INDEX "idx_escalation_claims_client_id" ON "escalation_claims" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_escalation_claims_status" ON "escalation_claims" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "business_hours_client_day_unique" ON "business_hours" USING btree ("client_id","day_of_week");--> statement-breakpoint
CREATE INDEX "idx_call_attempts_lead_id" ON "call_attempts" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_call_attempts_client_id" ON "call_attempts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_call_attempts_status" ON "call_attempts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ab_test_metrics_test_id" ON "ab_test_metrics" USING btree ("test_id");--> statement-breakpoint
CREATE INDEX "idx_ab_test_metrics_date" ON "ab_test_metrics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_ab_test_metrics_test_variant" ON "ab_test_metrics" USING btree ("test_id","variant");--> statement-breakpoint
CREATE INDEX "idx_ab_tests_client_id" ON "ab_tests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_ab_tests_status" ON "ab_tests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ab_tests_client_status" ON "ab_tests" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "idx_reports_client_id" ON "reports" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_reports_date_range" ON "reports" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_report_deliveries_client" ON "report_deliveries" USING btree ("client_id","period_end");--> statement-breakpoint
CREATE INDEX "idx_report_deliveries_state" ON "report_deliveries" USING btree ("state","last_state_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_report_deliveries_cycle_channel" ON "report_deliveries" USING btree ("client_id","report_type","period_start","period_end","channel");--> statement-breakpoint
CREATE INDEX "idx_report_delivery_events_delivery" ON "report_delivery_events" USING btree ("delivery_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_template_variants_type" ON "template_variants" USING btree ("template_type");--> statement-breakpoint
CREATE INDEX "idx_template_variants_active" ON "template_variants" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_template_perf_variant" ON "template_performance_metrics" USING btree ("template_variant_id");--> statement-breakpoint
CREATE INDEX "idx_template_perf_date" ON "template_performance_metrics" USING btree ("date_collected");--> statement-breakpoint
CREATE INDEX "idx_template_perf_period" ON "template_performance_metrics" USING btree ("period");--> statement-breakpoint
CREATE INDEX "idx_template_perf_variant_date" ON "template_performance_metrics" USING btree ("template_variant_id","date_collected");--> statement-breakpoint
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
CREATE INDEX "idx_otp_codes_phone_expires" ON "otp_codes" USING btree ("phone","expires_at");--> statement-breakpoint
CREATE INDEX "idx_otp_codes_email_expires" ON "otp_codes" USING btree ("email","expires_at");--> statement-breakpoint
CREATE INDEX "idx_otp_codes_client_id" ON "otp_codes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_otp_codes_person_id" ON "otp_codes" USING btree ("person_id");--> statement-breakpoint
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
CREATE INDEX "idx_knowledge_gaps_client" ON "knowledge_gaps" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_gaps_status" ON "knowledge_gaps" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "idx_knowledge_gaps_priority" ON "knowledge_gaps" USING btree ("client_id","priority_score","status");--> statement-breakpoint
CREATE INDEX "idx_knowledge_gaps_due" ON "knowledge_gaps" USING btree ("due_at","status");--> statement-breakpoint
CREATE INDEX "idx_knowledge_gaps_last_seen" ON "knowledge_gaps" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "idx_cancellation_requests_client" ON "cancellation_requests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_cancellation_requests_status" ON "cancellation_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_data_export_requests_client" ON "data_export_requests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_data_export_requests_status" ON "data_export_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_data_export_requests_due_at" ON "data_export_requests" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "idx_data_export_requests_cancellation" ON "data_export_requests" USING btree ("cancellation_request_id");--> statement-breakpoint
CREATE INDEX "idx_onboarding_activities_client" ON "onboarding_milestone_activities" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_onboarding_activities_milestone" ON "onboarding_milestone_activities" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "idx_onboarding_milestones_client" ON "onboarding_milestones" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_onboarding_milestones_status_target" ON "onboarding_milestones" USING btree ("status","target_at");--> statement-breakpoint
CREATE INDEX "idx_onboarding_sla_alerts_client_status" ON "onboarding_sla_alerts" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "idx_onboarding_sla_alerts_milestone" ON "onboarding_sla_alerts" USING btree ("milestone_key");--> statement-breakpoint
CREATE INDEX "idx_revenue_leak_audits_status" ON "revenue_leak_audits" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_onboarding_quality_overrides_client" ON "onboarding_quality_overrides" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_onboarding_quality_overrides_active" ON "onboarding_quality_overrides" USING btree ("is_active","expires_at");--> statement-breakpoint
CREATE INDEX "idx_onboarding_quality_snapshots_client_created" ON "onboarding_quality_snapshots" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_onboarding_quality_snapshots_source" ON "onboarding_quality_snapshots" USING btree ("source","created_at");--> statement-breakpoint
CREATE INDEX "idx_client_services_client" ON "client_services" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_services_active" ON "client_services" USING btree ("client_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_jobs_client" ON "jobs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_status" ON "jobs" USING btree ("status");--> statement-breakpoint
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
CREATE INDEX "idx_agency_messages_client_id" ON "agency_messages" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_agency_messages_category" ON "agency_messages" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_agency_messages_action_status" ON "agency_messages" USING btree ("action_status");--> statement-breakpoint
CREATE INDEX "idx_agency_messages_created_at" ON "agency_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_quarterly_campaigns_client" ON "quarterly_campaigns" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_quarterly_campaigns_status" ON "quarterly_campaigns" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_quarterly_campaigns_quarter" ON "quarterly_campaigns" USING btree ("quarter_key");--> statement-breakpoint
CREATE INDEX "cron_job_cursors_status_idx" ON "cron_job_cursors" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cron_job_cursors_backlog_idx" ON "cron_job_cursors" USING btree ("backlog_count");--> statement-breakpoint
CREATE INDEX "cron_job_cursors_last_run_idx" ON "cron_job_cursors" USING btree ("last_run_at");--> statement-breakpoint
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
CREATE INDEX "agent_decisions_client_created_idx" ON "agent_decisions" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_decisions_client_action_created_idx" ON "agent_decisions" USING btree ("client_id","action","created_at");--> statement-breakpoint
CREATE INDEX "agent_decisions_outcome_idx" ON "agent_decisions" USING btree ("outcome");--> statement-breakpoint
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
CREATE UNIQUE INDEX "billing_events_idempotency_idx" ON "billing_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "billing_events_created_idx" ON "billing_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_addon_billing_events_client" ON "addon_billing_events" USING btree ("client_id","period_start");--> statement-breakpoint
CREATE INDEX "idx_addon_billing_events_type" ON "addon_billing_events" USING btree ("addon_type","status");--> statement-breakpoint
CREATE INDEX "idx_addon_billing_events_invoice" ON "addon_billing_events" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_addon_billing_events_dispute" ON "addon_billing_events" USING btree ("client_id","dispute_status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_addon_billing_events_idempotency" ON "addon_billing_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_idx" ON "coupons" USING btree ("code");--> statement-breakpoint
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
CREATE INDEX "funnel_events_decision_idx" ON "funnel_events" USING btree ("agent_decision_id");--> statement-breakpoint
CREATE INDEX "client_cohorts_cohort_idx" ON "client_cohorts" USING btree ("cohort_month");--> statement-breakpoint
CREATE INDEX "idx_help_articles_slug" ON "help_articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_help_articles_published" ON "help_articles" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "idx_nps_surveys_client" ON "nps_surveys" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_nps_surveys_lead" ON "nps_surveys" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_nps_surveys_status" ON "nps_surveys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_email_templates_slug" ON "email_templates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_api_keys_client" ON "api_keys" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_prefix" ON "api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "cpn_client_id_idx" ON "client_phone_numbers" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "cpn_phone_number_idx" ON "client_phone_numbers" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "idx_users_person_id" ON "users" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "people_email_unique" ON "people" USING btree ("email") WHERE email IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "people_phone_unique" ON "people" USING btree ("phone") WHERE phone IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_people_email" ON "people" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_people_phone" ON "people" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_role_templates_scope" ON "role_templates" USING btree ("scope");--> statement-breakpoint
CREATE UNIQUE INDEX "client_memberships_one_owner_per_client" ON "client_memberships" USING btree ("client_id") WHERE is_owner = true;--> statement-breakpoint
CREATE INDEX "idx_client_memberships_client_id" ON "client_memberships" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_memberships_person_id" ON "client_memberships" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_agency_memberships_person_id" ON "agency_memberships" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_aca_membership_id" ON "agency_client_assignments" USING btree ("agency_membership_id");--> statement-breakpoint
CREATE INDEX "idx_aca_client_id" ON "agency_client_assignments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_person_id" ON "audit_log" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_client_id" ON "audit_log" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_action" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_log_created_at" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_resource" ON "audit_log" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_roi_leads_email" ON "roi_calculator_leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_roi_leads_created_at" ON "roi_calculator_leads" USING btree ("created_at");