ALTER TABLE "leads" ADD COLUMN "inquiry_date" timestamp;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "dormant_reengagement_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "consent_records" ADD COLUMN "consent_evidence" text;