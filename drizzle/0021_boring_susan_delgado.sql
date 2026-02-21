ALTER TABLE "team_members" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "team_members" CASCADE;--> statement-breakpoint
DROP TABLE "admin_users" CASCADE;--> statement-breakpoint
ALTER TABLE "escalation_claims" DROP CONSTRAINT "escalation_claims_claimed_by_team_members_id_fk";
--> statement-breakpoint
ALTER TABLE "call_attempts" DROP CONSTRAINT "call_attempts_answered_by_team_members_id_fk";
--> statement-breakpoint
ALTER TABLE "calendar_events" DROP CONSTRAINT "calendar_events_assigned_team_member_id_team_members_id_fk";
--> statement-breakpoint
ALTER TABLE "escalation_queue" DROP CONSTRAINT "escalation_queue_assigned_to_team_members_id_fk";
--> statement-breakpoint
ALTER TABLE "escalation_queue" DROP CONSTRAINT "escalation_queue_resolved_by_team_members_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "escalation_claims" ADD CONSTRAINT "escalation_claims_claimed_by_client_memberships_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."client_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_answered_by_client_memberships_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."client_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_assigned_team_member_id_client_memberships_id_fk" FOREIGN KEY ("assigned_team_member_id") REFERENCES "public"."client_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_queue" ADD CONSTRAINT "escalation_queue_assigned_to_client_memberships_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."client_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_queue" ADD CONSTRAINT "escalation_queue_resolved_by_client_memberships_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."client_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "client_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_admin";