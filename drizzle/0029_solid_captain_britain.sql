ALTER TABLE "addon_billing_events" ADD COLUMN "invoice_id" uuid;
--> statement-breakpoint
ALTER TABLE "addon_billing_events" ADD COLUMN "invoice_line_item_ref" varchar(160);
--> statement-breakpoint
ALTER TABLE "addon_billing_events" ADD COLUMN "dispute_status" varchar(20) DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE "addon_billing_events" ADD COLUMN "dispute_note" text;
--> statement-breakpoint
ALTER TABLE "addon_billing_events" ADD COLUMN "disputed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "addon_billing_events" ADD COLUMN "resolved_at" timestamp;
--> statement-breakpoint
ALTER TABLE "addon_billing_events" ADD COLUMN "resolved_by" varchar(120);
--> statement-breakpoint
ALTER TABLE "addon_billing_events" ADD CONSTRAINT "addon_billing_events_invoice_id_subscription_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."subscription_invoices"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_addon_billing_events_invoice" ON "addon_billing_events" USING btree ("invoice_id");
--> statement-breakpoint
CREATE INDEX "idx_addon_billing_events_dispute" ON "addon_billing_events" USING btree ("client_id","dispute_status");
