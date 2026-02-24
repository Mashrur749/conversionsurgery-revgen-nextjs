ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_start_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_status" varchar(40) DEFAULT 'proof_pending';--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_proof_start_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_proof_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_recovery_start_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_recovery_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_adjusted_proof_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_adjusted_recovery_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_observed_monthly_lead_average" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_extension_factor_basis_points" integer DEFAULT 10000;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_proof_qualified_lead_engagements" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_recovery_attributed_opportunities" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_fulfilled_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_recovered_lead_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_refund_eligible_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_refunded_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "guarantee_notes" text;--> statement-breakpoint

-- Legacy -> v2 status mapping for safe rollout.
UPDATE "subscriptions"
SET "guarantee_status" = CASE
  WHEN "guarantee_status" = 'pending' THEN 'proof_pending'
  WHEN "guarantee_status" = 'fulfilled' THEN 'proof_passed'
  WHEN "guarantee_status" = 'refund_review_required' THEN 'proof_failed_refund_review'
  WHEN "guarantee_status" IS NULL THEN 'proof_pending'
  ELSE "guarantee_status"
END;--> statement-breakpoint

-- Initialize guarantee v2 windows where missing.
UPDATE "subscriptions"
SET
  "guarantee_start_at" = COALESCE("guarantee_start_at", "created_at"),
  "guarantee_ends_at" = COALESCE(
    "guarantee_ends_at",
    COALESCE("guarantee_start_at", "created_at") + INTERVAL '30 days'
  ),
  "guarantee_proof_start_at" = COALESCE("guarantee_proof_start_at", "guarantee_start_at", "created_at"),
  "guarantee_proof_ends_at" = COALESCE(
    "guarantee_proof_ends_at",
    "guarantee_ends_at",
    COALESCE("guarantee_start_at", "created_at") + INTERVAL '30 days'
  ),
  "guarantee_recovery_start_at" = COALESCE("guarantee_recovery_start_at", "guarantee_start_at", "created_at"),
  "guarantee_recovery_ends_at" = COALESCE(
    "guarantee_recovery_ends_at",
    COALESCE("guarantee_start_at", "created_at") + INTERVAL '90 days'
  ),
  "guarantee_adjusted_proof_ends_at" = COALESCE("guarantee_adjusted_proof_ends_at", "guarantee_proof_ends_at", "guarantee_ends_at"),
  "guarantee_adjusted_recovery_ends_at" = COALESCE("guarantee_adjusted_recovery_ends_at", "guarantee_recovery_ends_at"),
  "guarantee_extension_factor_basis_points" = COALESCE("guarantee_extension_factor_basis_points", 10000),
  "guarantee_proof_qualified_lead_engagements" = COALESCE("guarantee_proof_qualified_lead_engagements", 0),
  "guarantee_recovery_attributed_opportunities" = COALESCE("guarantee_recovery_attributed_opportunities", 0)
WHERE "status" IN ('trialing', 'active', 'past_due', 'paused', 'canceled', 'unpaid');
