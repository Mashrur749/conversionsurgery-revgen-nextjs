CREATE TABLE "cron_job_cursors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_key" varchar(100) NOT NULL,
	"period_type" varchar(20) NOT NULL,
	"last_successful_period" date,
	"last_run_at" timestamp,
	"last_success_at" timestamp,
	"status" varchar(20) DEFAULT 'idle' NOT NULL,
	"backlog_count" integer DEFAULT 0 NOT NULL,
	"last_error_message" text,
	"last_error_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cron_job_cursors_job_key_unique" UNIQUE("job_key")
);
--> statement-breakpoint
CREATE INDEX "cron_job_cursors_status_idx" ON "cron_job_cursors" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "cron_job_cursors_backlog_idx" ON "cron_job_cursors" USING btree ("backlog_count");
--> statement-breakpoint
CREATE INDEX "cron_job_cursors_last_run_idx" ON "cron_job_cursors" USING btree ("last_run_at");
--> statement-breakpoint
ALTER TABLE "billing_events" ADD COLUMN "idempotency_key" varchar(200);
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_events_idempotency_idx" ON "billing_events" USING btree ("idempotency_key");
--> statement-breakpoint
INSERT INTO "cron_job_cursors" ("job_key", "period_type", "status", "backlog_count")
VALUES
  ('monthly_reset', 'monthly', 'idle', 0),
  ('biweekly_reports', 'biweekly', 'idle', 0)
ON CONFLICT ("job_key") DO NOTHING;
--> statement-breakpoint
UPDATE "cron_job_cursors"
SET "last_successful_period" = (
  SELECT (ss.value || '-01')::date
  FROM "system_settings" ss
  WHERE ss.key = 'last_monthly_reset_period'
),
"last_success_at" = now(),
"last_run_at" = now(),
"updated_at" = now()
WHERE "job_key" = 'monthly_reset'
  AND "last_successful_period" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "system_settings" ss
    WHERE ss.key = 'last_monthly_reset_period'
      AND ss.value ~ '^\\d{4}-\\d{2}$'
  );
--> statement-breakpoint
UPDATE "cron_job_cursors"
SET "last_successful_period" = (
  SELECT ss.value::date
  FROM "system_settings" ss
  WHERE ss.key = 'last_biweekly_report_period_end'
),
"last_success_at" = now(),
"last_run_at" = now(),
"updated_at" = now()
WHERE "job_key" = 'biweekly_reports'
  AND "last_successful_period" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "system_settings" ss
    WHERE ss.key = 'last_biweekly_report_period_end'
      AND ss.value ~ '^\\d{4}-\\d{2}-\\d{2}$'
  );
