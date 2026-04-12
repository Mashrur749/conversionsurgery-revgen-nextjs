ALTER TABLE "appointments" ALTER COLUMN "status" SET DATA TYPE varchar(30);--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "status" SET DEFAULT 'scheduled';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "booking_confirmation_required" boolean DEFAULT false;