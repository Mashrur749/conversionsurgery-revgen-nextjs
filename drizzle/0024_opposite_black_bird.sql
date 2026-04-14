ALTER TABLE "clients" ADD COLUMN "exclusion_list_reviewed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "exclusion_list_reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "exclusion_list_reviewed_by_person_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "estimated_lead_volume" integer;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "average_project_value" integer;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "dead_quote_count" integer;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "low_volume_disclosure_acknowledged" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "forwarding_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "forwarding_verification_status" varchar(20);--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_exclusion_list_reviewed_by_person_id_people_id_fk" FOREIGN KEY ("exclusion_list_reviewed_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;