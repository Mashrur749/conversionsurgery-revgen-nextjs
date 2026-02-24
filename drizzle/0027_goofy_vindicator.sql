CREATE TYPE "public"."onboarding_milestone_status" AS ENUM('pending', 'completed', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."onboarding_sla_alert_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."revenue_leak_audit_status" AS ENUM('draft', 'delivered');--> statement-breakpoint
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
ALTER TABLE "onboarding_milestone_activities" ADD CONSTRAINT "onboarding_milestone_activities_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_milestone_activities" ADD CONSTRAINT "onboarding_milestone_activities_milestone_id_onboarding_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."onboarding_milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_milestones" ADD CONSTRAINT "onboarding_milestones_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_sla_alerts" ADD CONSTRAINT "onboarding_sla_alerts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_sla_alerts" ADD CONSTRAINT "onboarding_sla_alerts_milestone_id_onboarding_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."onboarding_milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_leak_audits" ADD CONSTRAINT "revenue_leak_audits_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_onboarding_activities_client" ON "onboarding_milestone_activities" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_onboarding_activities_milestone" ON "onboarding_milestone_activities" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "idx_onboarding_milestones_client" ON "onboarding_milestones" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_onboarding_milestones_status_target" ON "onboarding_milestones" USING btree ("status","target_at");--> statement-breakpoint
CREATE INDEX "idx_onboarding_sla_alerts_client_status" ON "onboarding_sla_alerts" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "idx_onboarding_sla_alerts_milestone" ON "onboarding_sla_alerts" USING btree ("milestone_key");--> statement-breakpoint
CREATE INDEX "idx_revenue_leak_audits_status" ON "revenue_leak_audits" USING btree ("status");