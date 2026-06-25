ALTER TABLE "knowledge_chunk" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
CREATE INDEX "knowledge_chunk_embedding_idx" ON "knowledge_chunk" USING hnsw ("embedding" vector_cosine_ops);