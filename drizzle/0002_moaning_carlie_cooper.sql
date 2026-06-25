CREATE TYPE "public"."memory_status" AS ENUM('pending', 'active', 'deleted');--> statement-breakpoint
ALTER TABLE "user_memory" ADD COLUMN "status" "memory_status" DEFAULT 'active' NOT NULL;