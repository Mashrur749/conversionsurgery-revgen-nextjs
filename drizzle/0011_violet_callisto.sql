ALTER TABLE "leads" ADD COLUMN "outcome_ref_code" varchar(8);--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_outcome_ref_unique" UNIQUE("client_id","outcome_ref_code");