CREATE TABLE "agencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) DEFAULT 'Default Agency' NOT NULL,
	"twilio_number" varchar(20),
	"twilio_number_sid" varchar(50),
	"operator_phone" varchar(20),
	"operator_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "service_model" varchar(20) DEFAULT 'managed' NOT NULL;