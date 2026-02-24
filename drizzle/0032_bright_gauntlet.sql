DROP INDEX IF EXISTS "idx_knowledge_gaps_unresolved";
--> statement-breakpoint
ALTER TABLE "knowledge_gaps" DROP COLUMN IF EXISTS "resolved";
--> statement-breakpoint
ALTER TABLE "knowledge_gaps" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'new' NOT NULL;
--> statement-breakpoint
ALTER TABLE "knowledge_gaps" ADD COLUMN IF NOT EXISTS "owner_person_id" uuid;
--> statement-breakpoint
ALTER TABLE "knowledge_gaps" ADD COLUMN IF NOT EXISTS "due_at" timestamp;
--> statement-breakpoint
ALTER TABLE "knowledge_gaps" ADD COLUMN IF NOT EXISTS "priority_score" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "knowledge_gaps" ADD COLUMN IF NOT EXISTS "review_required" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "knowledge_gaps" ADD COLUMN IF NOT EXISTS "resolution_note" text;
--> statement-breakpoint
ALTER TABLE "knowledge_gaps" ADD COLUMN IF NOT EXISTS "resolved_by_person_id" uuid;
--> statement-breakpoint
ALTER TABLE "knowledge_gaps" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp;
--> statement-breakpoint
ALTER TABLE "knowledge_gaps" ADD COLUMN IF NOT EXISTS "verified_by_person_id" uuid;
--> statement-breakpoint
ALTER TABLE "knowledge_gaps" ADD COLUMN IF NOT EXISTS "verified_at" timestamp;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "knowledge_gaps"
    ADD CONSTRAINT "knowledge_gaps_owner_person_id_people_id_fk"
    FOREIGN KEY ("owner_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "knowledge_gaps"
    ADD CONSTRAINT "knowledge_gaps_resolved_by_person_id_people_id_fk"
    FOREIGN KEY ("resolved_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "knowledge_gaps"
    ADD CONSTRAINT "knowledge_gaps_verified_by_person_id_people_id_fk"
    FOREIGN KEY ("verified_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "knowledge_gaps"
    ADD CONSTRAINT "knowledge_gaps_resolved_by_kb_id_knowledge_base_id_fk"
    FOREIGN KEY ("resolved_by_kb_id") REFERENCES "public"."knowledge_base"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
UPDATE "knowledge_gaps"
SET
  "priority_score" = LEAST(
    10,
    GREATEST(
      1,
      COALESCE("occurrences", 1) + CASE WHEN COALESCE("confidence_level", 'medium') = 'low' THEN 3 ELSE 1 END
    )
  ),
  "review_required" = LEAST(
    10,
    GREATEST(
      1,
      COALESCE("occurrences", 1) + CASE WHEN COALESCE("confidence_level", 'medium') = 'low' THEN 3 ELSE 1 END
    )
  ) >= 8,
  "due_at" = COALESCE(
    "due_at",
    CASE
      WHEN LEAST(
        10,
        GREATEST(
          1,
          COALESCE("occurrences", 1) + CASE WHEN COALESCE("confidence_level", 'medium') = 'low' THEN 3 ELSE 1 END
        )
      ) >= 9 THEN now() + INTERVAL '1 day'
      WHEN LEAST(
        10,
        GREATEST(
          1,
          COALESCE("occurrences", 1) + CASE WHEN COALESCE("confidence_level", 'medium') = 'low' THEN 3 ELSE 1 END
        )
      ) >= 7 THEN now() + INTERVAL '2 days'
      WHEN LEAST(
        10,
        GREATEST(
          1,
          COALESCE("occurrences", 1) + CASE WHEN COALESCE("confidence_level", 'medium') = 'low' THEN 3 ELSE 1 END
        )
      ) >= 5 THEN now() + INTERVAL '3 days'
      ELSE now() + INTERVAL '5 days'
    END
  )
WHERE "status" = 'new';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_gaps_status" ON "knowledge_gaps" USING btree ("client_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_gaps_priority" ON "knowledge_gaps" USING btree ("client_id","priority_score","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_gaps_due" ON "knowledge_gaps" USING btree ("due_at","status");
