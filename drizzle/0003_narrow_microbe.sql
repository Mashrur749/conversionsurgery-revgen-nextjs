CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(255),
	"role" varchar(50),
	"receive_escalations" boolean DEFAULT true,
	"receive_hot_transfers" boolean DEFAULT true,
	"priority" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "escalation_claims" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"lead_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"claimed_by" uuid,
	"claim_token" varchar(64) NOT NULL,
	"escalation_reason" varchar(255),
	"last_lead_message" text,
	"status" varchar(20) DEFAULT 'pending',
	"notified_at" timestamp DEFAULT now(),
	"claimed_at" timestamp,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "escalation_claims_claim_token_unique" UNIQUE("claim_token")
);
--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_claims" ADD CONSTRAINT "escalation_claims_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_claims" ADD CONSTRAINT "escalation_claims_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_claims" ADD CONSTRAINT "escalation_claims_claimed_by_team_members_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_team_members_client_id" ON "team_members" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_escalation_claims_lead_id" ON "escalation_claims" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_escalation_claims_token" ON "escalation_claims" USING btree ("claim_token");--> statement-breakpoint
CREATE INDEX "idx_escalation_claims_client_id" ON "escalation_claims" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_escalation_claims_status" ON "escalation_claims" USING btree ("status");