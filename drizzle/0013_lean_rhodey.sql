CREATE TABLE "knowledge_gaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"question" text NOT NULL,
	"category" text,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"confidence_level" text NOT NULL,
	"resolved" timestamp,
	"resolved_by_kb_id" uuid,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quiet_hours_config" ALTER COLUMN "quiet_end_hour" SET DEFAULT 10;--> statement-breakpoint
ALTER TABLE "knowledge_gaps" ADD CONSTRAINT "knowledge_gaps_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_knowledge_gaps_client" ON "knowledge_gaps" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_gaps_unresolved" ON "knowledge_gaps" USING btree ("client_id","resolved");--> statement-breakpoint
CREATE INDEX "idx_knowledge_gaps_last_seen" ON "knowledge_gaps" USING btree ("last_seen_at");