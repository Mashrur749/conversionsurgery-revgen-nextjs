CREATE TABLE "template_variants" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"template_type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "template_variants_type_name_unique" UNIQUE("template_type","name")
);
--> statement-breakpoint
CREATE TABLE "template_performance_metrics" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"template_variant_id" uuid NOT NULL,
	"date_collected" date NOT NULL,
	"period" varchar(10) NOT NULL,
	"total_executions" integer DEFAULT 0,
	"total_delivered" integer DEFAULT 0,
	"total_conversations_started" integer DEFAULT 0,
	"total_appointments_reminded" integer DEFAULT 0,
	"total_estimates_followed_up" integer DEFAULT 0,
	"total_forms_responded" integer DEFAULT 0,
	"total_leads_qualified" integer DEFAULT 0,
	"total_revenue_recovered" numeric(12, 2),
	"delivery_rate" numeric(5, 4) DEFAULT '0',
	"engagement_rate" numeric(5, 4) DEFAULT '0',
	"conversion_rate" numeric(5, 4) DEFAULT '0',
	"avg_response_time" integer,
	"clients_using_variant" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "template_variant_id" uuid;--> statement-breakpoint
ALTER TABLE "template_performance_metrics" ADD CONSTRAINT "template_performance_metrics_template_variant_id_template_variants_id_fk" FOREIGN KEY ("template_variant_id") REFERENCES "public"."template_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_template_variants_type" ON "template_variants" USING btree ("template_type");--> statement-breakpoint
CREATE INDEX "idx_template_variants_active" ON "template_variants" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_template_perf_variant" ON "template_performance_metrics" USING btree ("template_variant_id");--> statement-breakpoint
CREATE INDEX "idx_template_perf_date" ON "template_performance_metrics" USING btree ("date_collected");--> statement-breakpoint
CREATE INDEX "idx_template_perf_period" ON "template_performance_metrics" USING btree ("period");--> statement-breakpoint
CREATE INDEX "idx_template_perf_variant_date" ON "template_performance_metrics" USING btree ("template_variant_id","date_collected");--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_template_variant_id_template_variants_id_fk" FOREIGN KEY ("template_variant_id") REFERENCES "public"."template_variants"("id") ON DELETE set null ON UPDATE no action;