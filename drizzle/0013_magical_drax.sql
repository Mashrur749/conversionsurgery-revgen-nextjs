CREATE TYPE "public"."embedding_status" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD COLUMN "embedding_status" "embedding_status" DEFAULT 'pending';