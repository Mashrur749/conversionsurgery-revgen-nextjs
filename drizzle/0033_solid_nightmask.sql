CREATE TABLE "onboarding_quality_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"source" varchar(40) DEFAULT 'system' NOT NULL,
	"policy_mode" varchar(20) DEFAULT 'enforce' NOT NULL,
	"evaluated_by_person_id" uuid,
	"total_score" integer DEFAULT 0 NOT NULL,
	"max_score" integer DEFAULT 0 NOT NULL,
	"passed_critical" boolean DEFAULT false NOT NULL,
	"passed_all" boolean DEFAULT false NOT NULL,
	"gate_results" jsonb NOT NULL,
	"critical_failures" jsonb,
	"recommended_actions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_quality_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"allow_autonomous_mode" boolean DEFAULT true NOT NULL,
	"reason" text NOT NULL,
	"approved_by_person_id" uuid,
	"approved_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onboarding_quality_snapshots" ADD CONSTRAINT "onboarding_quality_snapshots_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "onboarding_quality_snapshots" ADD CONSTRAINT "onboarding_quality_snapshots_evaluated_by_person_id_people_id_fk" FOREIGN KEY ("evaluated_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "onboarding_quality_overrides" ADD CONSTRAINT "onboarding_quality_overrides_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "onboarding_quality_overrides" ADD CONSTRAINT "onboarding_quality_overrides_approved_by_person_id_people_id_fk" FOREIGN KEY ("approved_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_onboarding_quality_snapshots_client_created" ON "onboarding_quality_snapshots" USING btree ("client_id","created_at");
--> statement-breakpoint
CREATE INDEX "idx_onboarding_quality_snapshots_source" ON "onboarding_quality_snapshots" USING btree ("source","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_onboarding_quality_overrides_client" ON "onboarding_quality_overrides" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX "idx_onboarding_quality_overrides_active" ON "onboarding_quality_overrides" USING btree ("is_active","expires_at");
