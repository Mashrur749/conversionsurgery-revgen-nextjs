CREATE TABLE "data_export_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"cancellation_request_id" uuid,
	"status" varchar(20) DEFAULT 'requested' NOT NULL,
	"requested_by" varchar(100) DEFAULT 'client_portal' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"due_at" timestamp NOT NULL,
	"started_at" timestamp,
	"ready_at" timestamp,
	"delivered_at" timestamp,
	"failed_at" timestamp,
	"failure_reason" text,
	"download_token" varchar(120),
	"download_token_expires_at" timestamp,
	"artifact_summary" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_cancellation_request_id_cancellation_requests_id_fk" FOREIGN KEY ("cancellation_request_id") REFERENCES "public"."cancellation_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_data_export_requests_client" ON "data_export_requests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_data_export_requests_status" ON "data_export_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_data_export_requests_due_at" ON "data_export_requests" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "idx_data_export_requests_cancellation" ON "data_export_requests" USING btree ("cancellation_request_id");