CREATE TABLE "report_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"report_id" uuid,
	"report_type" varchar(50) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"channel" varchar(20) DEFAULT 'email' NOT NULL,
	"recipient" text,
	"state" varchar(20) DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"channel_metadata" jsonb,
	"last_error_code" varchar(100),
	"last_error_message" text,
	"generated_at" timestamp,
	"queued_at" timestamp,
	"sent_at" timestamp,
	"failed_at" timestamp,
	"retried_at" timestamp,
	"last_state_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_delivery_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"from_state" varchar(20),
	"to_state" varchar(20) NOT NULL,
	"error_code" varchar(100),
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "report_delivery_events" ADD CONSTRAINT "report_delivery_events_delivery_id_report_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."report_deliveries"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_report_deliveries_client" ON "report_deliveries" USING btree ("client_id","period_end");
--> statement-breakpoint
CREATE INDEX "idx_report_deliveries_state" ON "report_deliveries" USING btree ("state","last_state_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_report_deliveries_cycle_channel" ON "report_deliveries" USING btree ("client_id","report_type","period_start","period_end","channel");
--> statement-breakpoint
CREATE INDEX "idx_report_delivery_events_delivery" ON "report_delivery_events" USING btree ("delivery_id","created_at");
