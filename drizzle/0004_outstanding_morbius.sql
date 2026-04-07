CREATE TYPE "public"."review_sentiment" AS ENUM('positive', 'neutral', 'negative', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."caller_intent" AS ENUM('booking', 'inquiry', 'complaint', 'follow_up', 'emergency', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."caller_sentiment" AS ENUM('positive', 'neutral', 'negative', 'frustrated', 'unknown');--> statement-breakpoint
ALTER TABLE "calendar_events" DROP CONSTRAINT "calendar_events_assigned_team_member_id_client_memberships_id_fk";
--> statement-breakpoint
ALTER TABLE "subscription_invoices" DROP CONSTRAINT "subscription_invoices_subscription_id_subscriptions_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "sentiment" SET DATA TYPE "public"."review_sentiment" USING "sentiment"::"public"."review_sentiment";--> statement-breakpoint
ALTER TABLE "voice_calls" ALTER COLUMN "caller_intent" SET DATA TYPE "public"."caller_intent" USING "caller_intent"::"public"."caller_intent";--> statement-breakpoint
ALTER TABLE "voice_calls" ALTER COLUMN "caller_sentiment" SET DATA TYPE "public"."caller_sentiment" USING "caller_sentiment"::"public"."caller_sentiment";--> statement-breakpoint
ALTER TABLE "flow_step_executions" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "flow_step_executions" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "do_not_contact_list" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_assigned_team_member_id_client_memberships_id_fk" FOREIGN KEY ("assigned_team_member_id") REFERENCES "public"."client_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_leads_conversation_mode" ON "leads" USING btree ("conversation_mode");--> statement-breakpoint
CREATE INDEX "idx_conversations_message_type" ON "conversations" USING btree ("message_type");--> statement-breakpoint
CREATE INDEX "idx_conversations_delivery_status" ON "conversations" USING btree ("delivery_status");--> statement-breakpoint
CREATE INDEX "revenue_events_client_created_idx" ON "revenue_events" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payments_paid_at" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "lead_context_matched_service_idx" ON "lead_context" USING btree ("matched_service_id");--> statement-breakpoint
CREATE INDEX "escalation_queue_triage_idx" ON "escalation_queue" USING btree ("status","priority","created_at");--> statement-breakpoint
CREATE INDEX "billing_events_client_type_created_idx" ON "billing_events" USING btree ("client_id","event_type","created_at");--> statement-breakpoint
CREATE INDEX "funnel_events_client_type_created_idx" ON "funnel_events" USING btree ("client_id","event_type","created_at");--> statement-breakpoint
ALTER TABLE "flow_steps" ADD CONSTRAINT "uq_flow_steps_flow_step_number" UNIQUE("flow_id","step_number");--> statement-breakpoint
ALTER TABLE "flow_step_executions" ADD CONSTRAINT "uq_flow_step_executions_execution_step" UNIQUE("flow_execution_id","step_number");--> statement-breakpoint
ALTER TABLE "client_phone_numbers" ADD CONSTRAINT "cpn_client_phone_unique" UNIQUE("client_id","phone_number");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_score_range" CHECK ("leads"."score" >= 0 AND "leads"."score" <= 100);--> statement-breakpoint
ALTER TABLE "quiet_hours_config" ADD CONSTRAINT "chk_quiet_start_hour_range" CHECK ("quiet_hours_config"."quiet_start_hour" >= 0 AND "quiet_hours_config"."quiet_start_hour" <= 23);--> statement-breakpoint
ALTER TABLE "quiet_hours_config" ADD CONSTRAINT "chk_quiet_end_hour_range" CHECK ("quiet_hours_config"."quiet_end_hour" >= 0 AND "quiet_hours_config"."quiet_end_hour" <= 23);--> statement-breakpoint
ALTER TABLE "quiet_hours_config" ADD CONSTRAINT "chk_weekend_quiet_start_hour_range" CHECK ("quiet_hours_config"."weekend_quiet_start_hour" IS NULL OR ("quiet_hours_config"."weekend_quiet_start_hour" >= 0 AND "quiet_hours_config"."weekend_quiet_start_hour" <= 23));--> statement-breakpoint
ALTER TABLE "quiet_hours_config" ADD CONSTRAINT "chk_weekend_quiet_end_hour_range" CHECK ("quiet_hours_config"."weekend_quiet_end_hour" IS NULL OR ("quiet_hours_config"."weekend_quiet_end_hour" >= 0 AND "quiet_hours_config"."weekend_quiet_end_hour" <= 23));--> statement-breakpoint
ALTER TABLE "lead_context" ADD CONSTRAINT "lead_context_urgency_score_range" CHECK ("lead_context"."urgency_score" >= 0 AND "lead_context"."urgency_score" <= 100);--> statement-breakpoint
ALTER TABLE "lead_context" ADD CONSTRAINT "lead_context_budget_score_range" CHECK ("lead_context"."budget_score" >= 0 AND "lead_context"."budget_score" <= 100);--> statement-breakpoint
ALTER TABLE "lead_context" ADD CONSTRAINT "lead_context_intent_score_range" CHECK ("lead_context"."intent_score" >= 0 AND "lead_context"."intent_score" <= 100);--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_price_monthly_non_negative" CHECK ("plans"."price_monthly" >= 0);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_discount_percent_range" CHECK ("subscriptions"."discount_percent" IS NULL OR ("subscriptions"."discount_percent" >= 0 AND "subscriptions"."discount_percent" <= 100));