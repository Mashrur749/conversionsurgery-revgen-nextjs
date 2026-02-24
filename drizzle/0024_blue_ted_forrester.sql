CREATE TYPE "public"."quarterly_campaign_status" AS ENUM('planned', 'scheduled', 'launched', 'completed');--> statement-breakpoint
CREATE TYPE "public"."quarterly_campaign_type" AS ENUM('dormant_reactivation', 'review_acceleration', 'pipeline_builder', 'year_end_strategy');--> statement-breakpoint
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
ALTER TABLE "quarterly_campaigns" ADD CONSTRAINT "quarterly_campaigns_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quarterly_campaigns" ADD CONSTRAINT "quarterly_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quarterly_campaigns" ADD CONSTRAINT "quarterly_campaigns_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_quarterly_campaigns_client" ON "quarterly_campaigns" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_quarterly_campaigns_status" ON "quarterly_campaigns" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_quarterly_campaigns_quarter" ON "quarterly_campaigns" USING btree ("quarter_key");