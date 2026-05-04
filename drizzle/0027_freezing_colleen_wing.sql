ALTER TABLE "plans" ADD COLUMN "price_setup_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "stripe_price_id_setup" varchar(100);--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "max_active_clients" integer;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "publicly_visible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_price_setup_non_negative" CHECK ("plans"."price_setup_cents" >= 0);--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_max_active_clients_positive" CHECK ("plans"."max_active_clients" IS NULL OR "plans"."max_active_clients" > 0);