DROP INDEX "message_conversation_idx";--> statement-breakpoint
CREATE INDEX "message_conversation_created_idx" ON "message" USING btree ("conversationId","createdAt");