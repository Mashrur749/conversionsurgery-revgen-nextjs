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
ALTER TABLE "clients" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "scheduled_messages" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "blocked_numbers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "blocked_numbers" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "error_log" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "error_log" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_log" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "webhook_log" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "message_templates" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "message_templates" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "message_templates" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_stats" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "daily_stats" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "active_calls" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "active_calls" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "team_members" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "team_members" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "team_members" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "escalation_claims" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "escalation_claims" ALTER COLUMN "notified_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "escalation_claims" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "business_hours" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "business_hours" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "call_attempts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "call_attempts" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ab_test_metrics" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "ab_test_metrics" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ab_tests" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "ab_tests" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ab_tests" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "template_variants" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "template_variants" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "template_variants" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "template_performance_metrics" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "template_performance_metrics" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "template_performance_metrics" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "api_usage" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "api_usage" ALTER COLUMN "units" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "api_usage_daily" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "api_usage_monthly" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "usage_alerts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "usage_alerts" ALTER COLUMN "acknowledged" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flow_template_steps" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "flow_template_steps" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flow_template_versions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "flow_template_versions" ALTER COLUMN "published_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flow_templates" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "flow_templates" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flow_templates" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flow_steps" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "flow_steps" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flows" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "flows" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flows" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flow_executions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "flow_executions" ALTER COLUMN "started_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "flow_step_executions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "suggested_actions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "suggested_actions" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "template_metrics_daily" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "template_metrics_daily" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "template_step_metrics" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "template_step_metrics" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "client_flow_outcomes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "client_flow_outcomes" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_base" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "knowledge_base" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_base" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "sms_new_lead" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "sms_escalation" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "sms_weekly_summary" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "sms_flow_approval" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "sms_negative_review" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "email_new_lead" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "email_daily_summary" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "email_weekly_summary" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "email_monthly_report" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "quiet_hours_enabled" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "quiet_hours_start" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "quiet_hours_end" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "urgent_override" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cancellation_requests" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "cancellation_requests" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "revenue_events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "revenue_events" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "media_attachments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "media_attachments" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "media_attachments" ALTER COLUMN "lead_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "media_attachments" ALTER COLUMN "mime_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "media_attachments" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_attachments" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "media_attachments" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_reminders" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "payment_reminders" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "fetched_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "review_sources" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "review_sources" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "review_sources" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "review_metrics" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "review_metrics" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "response_templates" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "response_templates" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "review_responses" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "review_responses" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "review_responses" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_integrations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "calendar_integrations" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_integrations" ALTER COLUMN "is_active" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_integrations" ALTER COLUMN "sync_enabled" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_integrations" ALTER COLUMN "sync_direction" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_integrations" ALTER COLUMN "consecutive_errors" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_integrations" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_integrations" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "is_all_day" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "timezone" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "sync_status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_calls" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "voice_calls" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "subscription_plans" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "system_settings" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "compliance_audit_log" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "compliance_check_cache" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "consent_records" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "consent_records" ALTER COLUMN "is_active" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "do_not_contact_list" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "do_not_contact_list" ALTER COLUMN "is_active" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "opt_out_records" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "quiet_hours_config" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "quiet_hours_config" ALTER COLUMN "respect_federal_holidays" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quiet_hours_config" ALTER COLUMN "holiday_quiet_all_day" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quiet_hours_config" ALTER COLUMN "enforce_quiet_hours" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quiet_hours_config" ALTER COLUMN "queue_during_quiet_hours" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_context" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "agent_decisions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "escalation_queue" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "escalation_rules" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "conversation_checkpoints" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "client_agent_settings" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_payment_methods" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "billing_payment_methods" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_payment_methods" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "subscription_invoices" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_records" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "usage_records" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "billing_events" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "coupons" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics_daily" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "analytics_weekly" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "analytics_monthly" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "platform_analytics" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "funnel_events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "client_cohorts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "support_messages" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "support_messages" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "support_messages" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "support_replies" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "support_replies" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agency_messages" ADD CONSTRAINT "agency_messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agency_messages_client_id" ON "agency_messages" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_agency_messages_category" ON "agency_messages" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_agency_messages_action_status" ON "agency_messages" USING btree ("action_status");--> statement-breakpoint
CREATE INDEX "idx_agency_messages_created_at" ON "agency_messages" USING btree ("created_at");