CREATE TABLE "client_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(100),
	"avg_value_cents" integer,
	"price_range_min_cents" integer,
	"price_range_max_cents" integer,
	"can_discuss_price" varchar(20) DEFAULT 'defer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "service_id" uuid;--> statement-breakpoint
ALTER TABLE "lead_context" ADD COLUMN "matched_service_id" uuid;--> statement-breakpoint
ALTER TABLE "client_services" ADD CONSTRAINT "client_services_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_client_services_client" ON "client_services" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_services_active" ON "client_services" USING btree ("client_id","is_active");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_service_id_client_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."client_services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_context" ADD CONSTRAINT "lead_context_matched_service_id_client_services_id_fk" FOREIGN KEY ("matched_service_id") REFERENCES "public"."client_services"("id") ON DELETE set null ON UPDATE no action;