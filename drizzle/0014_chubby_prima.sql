ALTER TABLE "calendar_events" ALTER COLUMN "timezone" SET DEFAULT 'America/Edmonton';--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "casl_consent_attested" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "casl_consent_attested_at" timestamp;