ALTER TYPE "public"."job_status" ADD VALUE 'in_progress' BEFORE 'lost';--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "timezone" SET DEFAULT 'America/New_York';--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "monthly_message_limit" SET DEFAULT 2000;--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "timezone" SET DEFAULT 'America/New_York';--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "duration_minutes" integer DEFAULT 60;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "assigned_team_member_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "milestone_type" varchar(20) DEFAULT 'standard';--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "parent_invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "assigned_membership_id" uuid;--> statement-breakpoint
ALTER TABLE "calendar_integrations" ADD COLUMN "membership_id" uuid;--> statement-breakpoint
ALTER TABLE "client_memberships" ADD COLUMN "receive_weekly_digest" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "client_memberships" ADD COLUMN "availability_status" varchar(20) DEFAULT 'available';--> statement-breakpoint
ALTER TABLE "client_memberships" ADD COLUMN "work_schedule" jsonb;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_assigned_team_member_id_client_memberships_id_fk" FOREIGN KEY ("assigned_team_member_id") REFERENCES "public"."client_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_parent_invoice_id_invoices_id_fk" FOREIGN KEY ("parent_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_assigned_membership_id_client_memberships_id_fk" FOREIGN KEY ("assigned_membership_id") REFERENCES "public"."client_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_integrations" ADD CONSTRAINT "calendar_integrations_membership_id_client_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."client_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_invoices_parent" ON "invoices" USING btree ("parent_invoice_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_integrations_membership" ON "calendar_integrations" USING btree ("membership_id");