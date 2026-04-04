CREATE TABLE "integration_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"webhook_url" text,
	"secret_key" varchar(255),
	"enabled" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_webhooks" ADD CONSTRAINT "integration_webhooks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_integration_webhooks_client_id" ON "integration_webhooks" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_integration_webhooks_client_provider" ON "integration_webhooks" USING btree ("client_id","provider","direction");