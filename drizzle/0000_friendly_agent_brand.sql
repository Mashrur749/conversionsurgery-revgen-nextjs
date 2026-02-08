CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"business_name" varchar(255) NOT NULL,
	"owner_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"twilio_number" varchar(20),
	"google_business_url" varchar(500),
	"timezone" varchar(50) DEFAULT 'America/Edmonton',
	"notification_email" boolean DEFAULT true,
	"notification_sms" boolean DEFAULT true,
	"webhook_url" varchar(500),
	"webhook_events" jsonb DEFAULT '["lead.created", "lead.qualified", "appointment.booked"]',
	"messages_sent_this_month" integer DEFAULT 0,
	"monthly_message_limit" integer DEFAULT 500,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"status" varchar(20) DEFAULT 'active',
	"is_test" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "clients_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(255),
	"phone" varchar(20) NOT NULL,
	"email" varchar(255),
	"address" varchar(500),
	"project_type" varchar(255),
	"notes" text,
	"source" varchar(50),
	"status" varchar(50) DEFAULT 'new',
	"action_required" boolean DEFAULT false,
	"action_required_reason" varchar(255),
	"opted_out" boolean DEFAULT false,
	"opted_out_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "leads_client_phone_unique" UNIQUE("client_id","phone")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"lead_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"direction" varchar(10),
	"message_type" varchar(20),
	"content" text NOT NULL,
	"twilio_sid" varchar(50),
	"ai_confidence" numeric(3, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scheduled_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"lead_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"sequence_type" varchar(50),
	"sequence_step" integer,
	"content" text NOT NULL,
	"send_at" timestamp NOT NULL,
	"sent" boolean DEFAULT false,
	"sent_at" timestamp,
	"cancelled" boolean DEFAULT false,
	"cancelled_at" timestamp,
	"cancelled_reason" varchar(255),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"lead_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"appointment_date" date NOT NULL,
	"appointment_time" time NOT NULL,
	"address" varchar(500),
	"status" varchar(20) DEFAULT 'scheduled',
	"reminder_day_before_sent" boolean DEFAULT false,
	"reminder_2hr_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"lead_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"invoice_number" varchar(50),
	"amount" numeric(10, 2),
	"due_date" date,
	"status" varchar(20) DEFAULT 'pending',
	"payment_link" varchar(500),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blocked_numbers" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"phone" varchar(20) NOT NULL,
	"reason" varchar(50),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "blocked_numbers_client_phone_unique" UNIQUE("client_id","phone")
);
--> statement-breakpoint
CREATE TABLE "error_log" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid,
	"error_type" varchar(100),
	"error_message" text,
	"error_details" jsonb,
	"resolved" boolean DEFAULT false,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_log" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"event_type" varchar(50),
	"payload" jsonb,
	"response_status" integer,
	"response_body" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"template_type" varchar(50),
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "message_templates_client_type_unique" UNIQUE("client_id","template_type")
);
--> statement-breakpoint
CREATE TABLE "daily_stats" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"date" date NOT NULL,
	"missed_calls_captured" integer DEFAULT 0,
	"forms_responded" integer DEFAULT 0,
	"conversations_started" integer DEFAULT 0,
	"appointments_reminded" integer DEFAULT 0,
	"estimates_followed_up" integer DEFAULT 0,
	"reviews_requested" integer DEFAULT 0,
	"referrals_requested" integer DEFAULT 0,
	"payments_reminded" integer DEFAULT 0,
	"messages_sent" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "daily_stats_client_date_unique" UNIQUE("client_id","date")
);
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_numbers" ADD CONSTRAINT "blocked_numbers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_log" ADD CONSTRAINT "error_log_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_log" ADD CONSTRAINT "webhook_log_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_clients_status" ON "clients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_leads_client_id" ON "leads" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_leads_phone" ON "leads" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_leads_status" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_leads_action_required" ON "leads" USING btree ("action_required") WHERE "leads"."action_required" = true;--> statement-breakpoint
CREATE INDEX "idx_conversations_lead_id" ON "conversations" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_client_id" ON "conversations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_messages_send_at" ON "scheduled_messages" USING btree ("send_at") WHERE "scheduled_messages"."sent" = false AND "scheduled_messages"."cancelled" = false;--> statement-breakpoint
CREATE INDEX "idx_scheduled_messages_client_id" ON "scheduled_messages" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_messages_lead_id" ON "scheduled_messages" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_appointments_date" ON "appointments" USING btree ("appointment_date");--> statement-breakpoint
CREATE INDEX "idx_appointments_client_id" ON "appointments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_blocked_numbers_phone" ON "blocked_numbers" USING btree ("client_id","phone");--> statement-breakpoint
CREATE INDEX "idx_daily_stats_client_date" ON "daily_stats" USING btree ("client_id","date");