DROP TABLE "subscription_plans" CASCADE;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "first_recovery_replay_sent_at" timestamp;