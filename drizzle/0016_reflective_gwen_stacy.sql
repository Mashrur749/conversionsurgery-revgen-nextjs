CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20),
	"email" varchar(255),
	"client_id" uuid NOT NULL,
	"code" varchar(6) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "help_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"content" text NOT NULL,
	"category" varchar(100),
	"sort_order" integer DEFAULT 0,
	"is_published" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "help_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "nps_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"appointment_id" uuid,
	"score" integer,
	"comment" text,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp,
	"sent_via" varchar(10) DEFAULT 'sms',
	"status" varchar(20) DEFAULT 'sent',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"html_body" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"label" varchar(255) NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"key_prefix" varchar(8) NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_phone_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"friendly_name" varchar(100),
	"is_primary" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"capabilities" jsonb,
	"purchased_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "delivery_status" varchar(20);--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "media_url" jsonb;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_surveys" ADD CONSTRAINT "nps_surveys_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_surveys" ADD CONSTRAINT "nps_surveys_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_surveys" ADD CONSTRAINT "nps_surveys_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_phone_numbers" ADD CONSTRAINT "client_phone_numbers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_otp_codes_phone_expires" ON "otp_codes" USING btree ("phone","expires_at");--> statement-breakpoint
CREATE INDEX "idx_otp_codes_email_expires" ON "otp_codes" USING btree ("email","expires_at");--> statement-breakpoint
CREATE INDEX "idx_otp_codes_client_id" ON "otp_codes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_help_articles_slug" ON "help_articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_help_articles_published" ON "help_articles" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "idx_nps_surveys_client" ON "nps_surveys" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_nps_surveys_lead" ON "nps_surveys" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_nps_surveys_status" ON "nps_surveys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_email_templates_slug" ON "email_templates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_api_keys_client" ON "api_keys" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_prefix" ON "api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "cpn_client_id_idx" ON "client_phone_numbers" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "cpn_phone_number_idx" ON "client_phone_numbers" USING btree ("phone_number");