DROP INDEX "user_memory_user_idx";--> statement-breakpoint
CREATE INDEX "user_memory_user_status_idx" ON "user_memory" USING btree ("userId","status");