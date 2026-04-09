ALTER TABLE "clients" ADD COLUMN "weekly_digest_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "weekly_digest_last_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "weekly_digest_consecutive_zero_weeks" integer DEFAULT 0;