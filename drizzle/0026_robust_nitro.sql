ALTER TABLE "clients" ADD COLUMN "web_form_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "listing_migration_status" varchar(20) DEFAULT 'not_applicable';