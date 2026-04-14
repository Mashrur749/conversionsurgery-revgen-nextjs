CREATE TABLE "ai_health_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period" varchar(20) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"metrics" jsonb NOT NULL,
	"alerts" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
