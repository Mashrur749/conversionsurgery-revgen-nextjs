CREATE TABLE "support_replies" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"support_message_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"author_email" varchar(255) NOT NULL,
	"calcom_link" varchar(500),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "support_messages" ADD COLUMN "status" varchar(20) DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "support_replies" ADD CONSTRAINT "support_replies_support_message_id_support_messages_id_fk" FOREIGN KEY ("support_message_id") REFERENCES "public"."support_messages"("id") ON DELETE cascade ON UPDATE no action;