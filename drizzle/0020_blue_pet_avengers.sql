CREATE TABLE "sales_methodology" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config" jsonb NOT NULL,
	"version" varchar(20) DEFAULT 'v1.0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locale_contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"locale_id" varchar(10) NOT NULL,
	"name" varchar(100) NOT NULL,
	"config" jsonb NOT NULL,
	"version" varchar(20) DEFAULT 'v1.0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "locale_contexts_locale_id_unique" UNIQUE("locale_id")
);
--> statement-breakpoint
CREATE TABLE "industry_playbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playbook_id" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"config" jsonb NOT NULL,
	"version" varchar(20) DEFAULT 'v1.0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "industry_playbooks_playbook_id_unique" UNIQUE("playbook_id")
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "locale_id" varchar(10) DEFAULT 'ca-ab';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "playbook_id" varchar(50) DEFAULT 'basement_development';--> statement-breakpoint
ALTER TABLE "lead_context" ADD COLUMN "conversation_stage" varchar(30) DEFAULT 'greeting';--> statement-breakpoint
ALTER TABLE "lead_context" ADD COLUMN "stage_turn_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "lead_context" ADD COLUMN "strategy_state" jsonb;