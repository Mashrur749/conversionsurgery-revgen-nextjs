CREATE TYPE "public"."escalation_queue_resolution" AS ENUM('handled', 'returned_to_ai', 'no_action', 'converted', 'lost');--> statement-breakpoint
CREATE TYPE "public"."escalation_queue_status" AS ENUM('pending', 'assigned', 'in_progress', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."guarantee_status" AS ENUM('pending', 'fulfilled', 'refund_review_required', 'proof_pending', 'proof_passed', 'proof_failed_refund_review', 'recovery_pending', 'recovery_passed', 'recovery_failed_refund_review');--> statement-breakpoint
ALTER TABLE "error_log" DROP CONSTRAINT "error_log_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "knowledge_gaps" DROP CONSTRAINT "knowledge_gaps_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "billing_payment_methods" DROP CONSTRAINT "billing_payment_methods_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "subscription_invoices" DROP CONSTRAINT "subscription_invoices_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "usage_records" DROP CONSTRAINT "usage_records_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "billing_events" DROP CONSTRAINT "billing_events_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "addon_billing_events" DROP CONSTRAINT "addon_billing_events_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "flow_template_versions" ALTER COLUMN "template_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "escalation_queue" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."escalation_queue_status";--> statement-breakpoint
ALTER TABLE "escalation_queue" ALTER COLUMN "status" SET DATA TYPE "public"."escalation_queue_status" USING "status"::"public"."escalation_queue_status";--> statement-breakpoint
ALTER TABLE "escalation_queue" ALTER COLUMN "resolution" SET DATA TYPE "public"."escalation_queue_resolution" USING "resolution"::"public"."escalation_queue_resolution";--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "guarantee_status" SET DEFAULT 'proof_pending'::"public"."guarantee_status";--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "guarantee_status" SET DATA TYPE "public"."guarantee_status" USING "guarantee_status"::"public"."guarantee_status";--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "is_active" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agencies" ALTER COLUMN "name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "escalation_claims" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "api_usage" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_decisions" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "funnel_events" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "error_log" ADD CONSTRAINT "error_log_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_gaps" ADD CONSTRAINT "knowledge_gaps_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_submitted_by_people_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_approved_by_people_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_messages" ADD CONSTRAINT "agency_messages_in_reply_to_agency_messages_id_fk" FOREIGN KEY ("in_reply_to") REFERENCES "public"."agency_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payment_methods" ADD CONSTRAINT "billing_payment_methods_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_billing_events" ADD CONSTRAINT "addon_billing_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_error_log_client_id" ON "error_log" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_error_log_error_type" ON "error_log" USING btree ("error_type");--> statement-breakpoint
CREATE INDEX "idx_error_log_created_at" ON "error_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_api_usage_archived_at" ON "api_usage" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "idx_flow_template_steps_template" ON "flow_template_steps" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_flow_template_versions_template" ON "flow_template_versions" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_agent_decisions_archived_at" ON "agent_decisions" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "idx_funnel_events_archived_at" ON "funnel_events" USING btree ("archived_at");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_confirmed_revenue_non_negative" CHECK ("leads"."confirmed_revenue" IS NULL OR "leads"."confirmed_revenue" >= 0);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoice_amounts_consistent" CHECK ("invoices"."total_amount" IS NULL OR "invoices"."paid_amount" IS NULL OR "invoices"."remaining_amount" IS NULL OR ("invoices"."paid_amount" + "invoices"."remaining_amount" = "invoices"."total_amount"));--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoice_total_non_negative" CHECK ("invoices"."total_amount" IS NULL OR "invoices"."total_amount" >= 0);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoice_paid_non_negative" CHECK ("invoices"."paid_amount" IS NULL OR "invoices"."paid_amount" >= 0);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoice_remaining_non_negative" CHECK ("invoices"."remaining_amount" IS NULL OR "invoices"."remaining_amount" >= 0);--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_at_least_one_contact" CHECK ("otp_codes"."phone" IS NOT NULL OR "otp_codes"."email" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "quiet_hours_start_format" CHECK ("notification_preferences"."quiet_hours_start" IS NULL OR "notification_preferences"."quiet_hours_start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "quiet_hours_end_format" CHECK ("notification_preferences"."quiet_hours_end" IS NULL OR "notification_preferences"."quiet_hours_end" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_valid_date_range" CHECK ("coupons"."valid_until" IS NULL OR "coupons"."valid_from" IS NULL OR "coupons"."valid_until" >= "coupons"."valid_from");--> statement-breakpoint
ALTER TABLE "role_templates" ADD CONSTRAINT "role_templates_scope_valid" CHECK ("role_templates"."scope" IN ('agency', 'client'));--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_resource_pair" CHECK (("audit_log"."resource_type" IS NOT NULL AND "audit_log"."resource_id" IS NOT NULL) OR ("audit_log"."resource_type" IS NULL AND "audit_log"."resource_id" IS NULL));