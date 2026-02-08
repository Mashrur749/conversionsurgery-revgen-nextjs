CREATE TABLE "business_hours" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"open_time" time,
	"close_time" time,
	"is_open" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "call_attempts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"lead_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"call_sid" varchar(50),
	"status" varchar(20),
	"answered_by" uuid,
	"duration" integer,
	"recording_url" varchar(500),
	"created_at" timestamp DEFAULT now(),
	"answered_at" timestamp,
	"ended_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_answered_by_team_members_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_hours_client_day_unique" ON "business_hours" USING btree ("client_id","day_of_week");--> statement-breakpoint
CREATE INDEX "idx_call_attempts_lead_id" ON "call_attempts" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_call_attempts_client_id" ON "call_attempts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_call_attempts_status" ON "call_attempts" USING btree ("status");