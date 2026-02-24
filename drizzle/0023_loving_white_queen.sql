ALTER TABLE "clients" ADD COLUMN "smart_assist_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "smart_assist_delay_minutes" integer DEFAULT 5;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "smart_assist_manual_categories" jsonb DEFAULT '["estimate_followup","payment"]';--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "assist_status" varchar(40);--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "assist_category" varchar(40);--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "assist_requires_manual" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "assist_original_content" text;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "assist_reference_code" varchar(12);--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "assist_notified_at" timestamp;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "assist_resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "assist_resolution_source" varchar(40);--> statement-breakpoint
ALTER TABLE "daily_stats" ADD COLUMN "smart_assist_pending" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "daily_stats" ADD COLUMN "smart_assist_auto_sent" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "daily_stats" ADD COLUMN "smart_assist_approved_sent" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "daily_stats" ADD COLUMN "smart_assist_cancelled" integer DEFAULT 0;--> statement-breakpoint
CREATE INDEX "idx_scheduled_messages_assist_status" ON "scheduled_messages" USING btree ("assist_status","send_at") WHERE "scheduled_messages"."assist_status" = 'pending_approval' AND "scheduled_messages"."sent" = false AND "scheduled_messages"."cancelled" = false;--> statement-breakpoint
CREATE INDEX "idx_scheduled_messages_assist_reference" ON "scheduled_messages" USING btree ("client_id","assist_reference_code");