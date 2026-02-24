CREATE TABLE "addon_billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"addon_type" varchar(40) NOT NULL,
	"source_type" varchar(40) NOT NULL,
	"source_ref" text,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addon_billing_events" ADD CONSTRAINT "addon_billing_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_addon_billing_events_client" ON "addon_billing_events" USING btree ("client_id","period_start");
--> statement-breakpoint
CREATE INDEX "idx_addon_billing_events_type" ON "addon_billing_events" USING btree ("addon_type","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_addon_billing_events_idempotency" ON "addon_billing_events" USING btree ("idempotency_key");
