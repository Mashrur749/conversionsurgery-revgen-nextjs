ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_plan_id_plans_id_fk";
--> statement-breakpoint
ALTER TABLE "usage_records" DROP CONSTRAINT "usage_records_subscription_id_subscriptions_id_fk";
--> statement-breakpoint
ALTER TABLE "usage_records" DROP CONSTRAINT "usage_records_billed_on_invoice_id_subscription_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "voice_calls" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "support_messages" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_billed_on_invoice_id_subscription_invoices_id_fk" FOREIGN KEY ("billed_on_invoice_id") REFERENCES "public"."subscription_invoices"("id") ON DELETE set null ON UPDATE no action;