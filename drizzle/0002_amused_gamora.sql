CREATE TABLE "active_calls" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"call_sid" varchar(100) NOT NULL,
	"client_id" uuid NOT NULL,
	"caller_phone" varchar(20) NOT NULL,
	"twilio_number" varchar(20) NOT NULL,
	"received_at" timestamp NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "active_calls" ADD CONSTRAINT "active_calls_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_active_calls_call_sid" ON "active_calls" USING btree ("call_sid");--> statement-breakpoint
CREATE INDEX "idx_active_calls_client_id" ON "active_calls" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_active_calls_received_at" ON "active_calls" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_active_calls_processed" ON "active_calls" USING btree ("processed");