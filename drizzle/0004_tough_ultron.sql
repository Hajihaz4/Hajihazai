CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "user_memory" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
CREATE INDEX "user_memory_embedding_idx" ON "user_memory" USING hnsw ("embedding" vector_cosine_ops);