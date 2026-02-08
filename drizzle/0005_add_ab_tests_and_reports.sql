CREATE TABLE "ab_test_metrics" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"test_id" uuid NOT NULL,
	"date" varchar(10) NOT NULL,
	"variant" varchar(1) NOT NULL,
	"messages_sent" integer DEFAULT 0,
	"messages_delivered" integer DEFAULT 0,
	"conversations_started" integer DEFAULT 0,
	"appointments_booked" integer DEFAULT 0,
	"forms_responded" integer DEFAULT 0,
	"leads_qualified" integer DEFAULT 0,
	"estimates_followed_up" integer DEFAULT 0,
	"conversions_completed" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ab_tests" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"test_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'active',
	"variant_a" jsonb NOT NULL,
	"variant_b" jsonb NOT NULL,
	"winner" varchar(1),
	"start_date" timestamp DEFAULT now(),
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"report_type" varchar(50) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"metrics" jsonb NOT NULL,
	"performance_data" jsonb,
	"test_results" jsonb,
	"team_performance" jsonb,
	"roi_summary" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ab_test_metrics" ADD CONSTRAINT "ab_test_metrics_test_id_ab_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."ab_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ab_tests" ADD CONSTRAINT "ab_tests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ab_test_metrics_test_id" ON "ab_test_metrics" USING btree ("test_id");--> statement-breakpoint
CREATE INDEX "idx_ab_test_metrics_date" ON "ab_test_metrics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_ab_test_metrics_test_variant" ON "ab_test_metrics" USING btree ("test_id","variant");--> statement-breakpoint
CREATE INDEX "idx_ab_tests_client_id" ON "ab_tests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_ab_tests_status" ON "ab_tests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ab_tests_client_status" ON "ab_tests" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "idx_reports_client_id" ON "reports" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_reports_date_range" ON "reports" USING btree ("start_date","end_date");