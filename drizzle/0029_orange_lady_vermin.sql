CREATE TABLE "client_cancellations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"cancel_type" varchar(32) NOT NULL,
	"reason_category" varchar(32) NOT NULL,
	"notes" text,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"captured_by" uuid
);
--> statement-breakpoint
ALTER TABLE "client_cancellations" ADD CONSTRAINT "client_cancellations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_cancellations" ADD CONSTRAINT "client_cancellations_captured_by_people_id_fk" FOREIGN KEY ("captured_by") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_client_cancellations_client" ON "client_cancellations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_cancellations_captured_at" ON "client_cancellations" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX "idx_client_cancellations_cancel_type" ON "client_cancellations" USING btree ("cancel_type");