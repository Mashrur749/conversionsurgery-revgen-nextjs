CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"avatar_url" varchar(500),
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "people_has_identifier" CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "role_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"scope" varchar(20) NOT NULL,
	"permissions" text[] NOT NULL,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "client_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"role_template_id" uuid NOT NULL,
	"permission_overrides" jsonb,
	"is_owner" boolean DEFAULT false NOT NULL,
	"receive_escalations" boolean DEFAULT false NOT NULL,
	"receive_hot_transfers" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_memberships_person_client_unique" UNIQUE("person_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "agency_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"role_template_id" uuid NOT NULL,
	"client_scope" varchar(20) DEFAULT 'all' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agency_memberships_person_id_unique" UNIQUE("person_id")
);
--> statement-breakpoint
CREATE TABLE "agency_client_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_membership_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "aca_membership_client_unique" UNIQUE("agency_membership_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid,
	"client_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(50),
	"resource_id" uuid,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"session_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "person_id" uuid;--> statement-breakpoint
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_role_template_id_role_templates_id_fk" FOREIGN KEY ("role_template_id") REFERENCES "public"."role_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_invited_by_people_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_memberships" ADD CONSTRAINT "agency_memberships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_memberships" ADD CONSTRAINT "agency_memberships_role_template_id_role_templates_id_fk" FOREIGN KEY ("role_template_id") REFERENCES "public"."role_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_memberships" ADD CONSTRAINT "agency_memberships_invited_by_people_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_client_assignments" ADD CONSTRAINT "agency_client_assignments_agency_membership_id_agency_memberships_id_fk" FOREIGN KEY ("agency_membership_id") REFERENCES "public"."agency_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_client_assignments" ADD CONSTRAINT "agency_client_assignments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "people_email_unique" ON "people" USING btree ("email") WHERE email IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "people_phone_unique" ON "people" USING btree ("phone") WHERE phone IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_people_email" ON "people" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_people_phone" ON "people" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_role_templates_scope" ON "role_templates" USING btree ("scope");--> statement-breakpoint
CREATE UNIQUE INDEX "client_memberships_one_owner_per_client" ON "client_memberships" USING btree ("client_id") WHERE is_owner = true;--> statement-breakpoint
CREATE INDEX "idx_client_memberships_client_id" ON "client_memberships" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_memberships_person_id" ON "client_memberships" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_agency_memberships_person_id" ON "agency_memberships" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_aca_membership_id" ON "agency_client_assignments" USING btree ("agency_membership_id");--> statement-breakpoint
CREATE INDEX "idx_aca_client_id" ON "agency_client_assignments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_person_id" ON "audit_log" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_client_id" ON "audit_log" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_action" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_log_created_at" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_resource" ON "audit_log" USING btree ("resource_type","resource_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_users_person_id" ON "users" USING btree ("person_id");