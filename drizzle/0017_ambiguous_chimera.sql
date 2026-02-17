CREATE TABLE "roi_calculator_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"business_name" text NOT NULL,
	"phone" varchar(20),
	"trade" varchar(100),
	"monthly_estimates" integer,
	"avg_project_value" numeric(12, 2),
	"current_close_rate" numeric(5, 2),
	"response_time" varchar(50),
	"after_hours_percent" numeric(5, 2),
	"follow_up_consistency" varchar(50),
	"follow_up_touches" integer,
	"hours_per_week" numeric(5, 1),
	"hourly_value" numeric(8, 2),
	"lost_revenue_annual" numeric(14, 2),
	"potential_revenue_annual" numeric(14, 2),
	"projected_roi" numeric(8, 2),
	"utm_source" varchar(255),
	"utm_medium" varchar(255),
	"utm_campaign" varchar(255),
	"referrer" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_roi_leads_email" ON "roi_calculator_leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_roi_leads_created_at" ON "roi_calculator_leads" USING btree ("created_at");